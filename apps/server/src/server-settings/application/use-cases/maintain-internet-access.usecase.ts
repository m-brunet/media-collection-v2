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

// The upkeep: keep the router rule and follow a changed public address on every run, then check
// that the domain name still points to it and renew the certificate. A certificate or domain name
// failure keeps the current certificate and waits longer before that work runs again; the router
// rule never waits, as it lapses at the end of its lease.
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

        if (access.phase !== 'active') {
            return;
        }

        await this.upkeep(access, now).catch(() => access.upkeepFailed('setup-failed', now));
        await this.store.save(access);
    }

    private async upkeep(access: InternetAccess, now: Date): Promise<void> {
        const { port } = await this.tls.read();
        const kept = await this.rules.keep(
            { externalPort: InternetAccess.externalPort, internalPort: port },
            access.mapping === 'manual',
        );

        if (kept.outcome === 'failed') {
            access.ruleFailed(kept.reason, now);

            return;
        }

        access.ruleKept();

        if (kept.address !== access.publicAddress) {
            access.addressChanged(kept.address);
        }

        if (!access.upkeepDue(now)) {
            return;
        }

        const reason = await this.certificateUpkeep(access);

        if (reason) {
            access.upkeepFailed(reason, now);
        } else {
            access.upkeepSucceeded();
        }
    }

    private async certificateUpkeep(
        access: InternetAccess,
    ): Promise<InternetAccessFailureReason | null> {
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
