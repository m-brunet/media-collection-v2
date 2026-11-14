import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessFailureReason } from '../../domain/entities/internet-access.entity.js';
import type { DomainNameReader } from '../ports/driven/domain-name-reader.interface.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { TlsSettingsReader } from '../ports/driven/tls-settings-reader.interface.js';
import type {
    MaintainInternetAccessUseCase,
    RuleUpkeepOutcome,
} from '../ports/driving/maintain-internet-access-use-case.interface.js';
import type { DomainNameCheck } from '../services/domain-name-check.service.js';
import type { InternetAccessSetup } from '../services/internet-access-setup.service.js';
import type { RouterRules } from '../services/router-rules.service.js';

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

    async execute(): Promise<RuleUpkeepOutcome> {
        const access = await this.store.read();
        const now = this.clock.now();

        if (access.phase === 'setting-up' && !this.setup.running) {
            access.interrupted(now);
            await this.store.save(access);

            return { rule: 'none' };
        }

        if (access.checking && !this.setup.running) {
            access.interrupted(now);
        }

        if (access.phase !== 'active') {
            return { rule: 'none' };
        }

        const outcome = await this.upkeep(access, now).catch((): RuleUpkeepOutcome => {
            access.upkeepFailed('setup-failed', now);

            return { rule: 'failed', reason: 'setup-failed' };
        });

        await this.store.save(access);

        return outcome;
    }

    private async upkeep(access: InternetAccess, now: Date): Promise<RuleUpkeepOutcome> {
        const { port } = await this.tls.read();
        const kept = await this.rules.keep(
            { externalPort: InternetAccess.checkPort, internalPort: port },
            access.mapping === 'manual',
        );

        if (kept.outcome === 'failed') {
            access.ruleFailed(kept.reason, now);

            return { rule: 'failed', reason: kept.reason };
        }

        access.ruleKept();

        if (kept.address !== access.publicAddress) {
            access.addressChanged(kept.address);
        }

        if (access.upkeepDue(now)) {
            const reason = await this.certificateUpkeep(access).catch(
                () => 'setup-failed' as const,
            );

            if (reason) {
                access.upkeepFailed(reason, now);
            } else {
                access.upkeepSucceeded();
            }
        }

        return {
            rule: 'kept',
            address: kept.address,
            problem: access.snapshot.failure?.reason ?? null,
        };
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
