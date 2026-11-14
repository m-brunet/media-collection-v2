import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessFailureReason } from '../../domain/entities/internet-access.entity.js';
import type { DomainNameReader } from '../ports/driven/domain-name-reader.interface.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { TlsSettingsReader } from '../ports/driven/tls-settings-reader.interface.js';
import type {
    MaintainInternetAccessUseCase,
    RuleUpkeepOutcome,
} from '../ports/driving/maintain-internet-access-use-case.interface.js';
import type { CheckPortWindow } from '../services/check-port-window.service.js';
import type { DomainNameCheck } from '../services/domain-name-check.service.js';
import type { HttpsRuleMove } from '../services/https-rule-move.service.js';
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
        private readonly window: CheckPortWindow,
        private readonly move: HttpsRuleMove,
        private readonly clock: Clock,
    ) {}

    async execute(): Promise<RuleUpkeepOutcome> {
        const access = await this.store.read();
        const now = this.clock.now();
        const { port } = await this.tls.read();
        const interrupted =
            (access.phase === 'setting-up' || access.checking) && !this.setup.running;

        if (interrupted) {
            const windowOpen = access.automatic && access.snapshot.step === 'certificate';

            access.interrupted(now);

            if (windowOpen) {
                await this.window.close(port);
            }
        }

        const moving = this.move.needed(access, port);

        if (moving) {
            await this.move.to(access, port);
        }

        if (access.phase !== 'active') {
            if (interrupted || moving) {
                await this.store.save(access);
            }

            return { rule: 'none' };
        }

        const outcome = await this.upkeep(access, port, now).catch((): RuleUpkeepOutcome => {
            access.upkeepFailed('setup-failed', now);

            return { rule: 'failed', reason: 'setup-failed' };
        });

        await this.store.save(access);

        return outcome;
    }

    private async upkeep(
        access: InternetAccess,
        port: number,
        now: Date,
    ): Promise<RuleUpkeepOutcome> {
        const kept = await this.rules.keep(
            { externalPort: port, internalPort: port },
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
