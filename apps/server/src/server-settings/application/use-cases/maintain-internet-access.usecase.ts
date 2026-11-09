import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessFailureReason } from '../../domain/entities/internet-access.entity.js';
import type { DomainNameReader } from '../ports/driven/domain-name-reader.interface.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { TlsSettingsReader } from '../ports/driven/tls-settings-reader.interface.js';
import type { MaintainInternetAccessUseCase } from '../ports/driving/maintain-internet-access-use-case.interface.js';
import type { DomainNameCheck } from '../services/domain-name-check.service.js';
import type { InternetAccessSetup } from '../services/internet-access-setup.service.js';
import type { RouterRules } from '../services/router-rules.service.js';

// The hourly upkeep: recreate the router rule, follow a changed public address, check that the
// domain name still points to it, and renew the certificate. A failure keeps the current
// certificate and waits longer before the next try.
export class MaintainInternetAccess implements MaintainInternetAccessUseCase {
    constructor(
        private readonly store: InternetAccessStore,
        private readonly rules: RouterRules,
        private readonly tls: TlsSettingsReader,
        private readonly setup: InternetAccessSetup,
        private readonly domains: DomainNameCheck,
        private readonly names: DomainNameReader,
        private readonly clock: Clock,
    ) {}

    async execute(): Promise<void> {
        const access = await this.store.read();
        const now = this.clock.now();

        if (access.phase === 'setting-up' && !this.setup.running) {
            access.interrupted(now);
            await this.store.save(access);

            return;
        }

        if (!access.upkeepDue(now)) {
            return;
        }

        const reason = await this.upkeep(access).catch(() => 'setup-failed' as const);

        if (reason) {
            access.upkeepFailed(reason, now);
        } else {
            access.upkeepSucceeded();
        }

        await this.store.save(access);
    }

    private async upkeep(access: InternetAccess): Promise<InternetAccessFailureReason | null> {
        const { port } = await this.tls.read();
        const kept = await this.rules.keep(
            { externalPort: InternetAccess.externalPort, internalPort: port },
            access.mapping === 'manual',
        );

        if (kept.outcome === 'failed') {
            return kept.reason;
        }

        if (kept.address !== access.publicAddress) {
            access.addressChanged(kept.address);
        }

        const saved = await this.names.read();

        if (saved !== access.domain) {
            access.useDomain(saved);
        }

        const problem = await this.domains.problem(access);

        if (problem) {
            return problem;
        }

        return access.renewalDue(this.clock.now()) ? this.setup.renew(access) : null;
    }
}
