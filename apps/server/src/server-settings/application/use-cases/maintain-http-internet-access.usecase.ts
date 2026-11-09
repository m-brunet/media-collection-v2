import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { HttpInternetAccessStore } from '../ports/driven/http-internet-access-store.interface.js';
import type { MaintainHttpInternetAccessUseCase } from '../ports/driving/maintain-http-internet-access-use-case.interface.js';
import type { RuleUpkeepOutcome } from '../ports/driving/maintain-internet-access-use-case.interface.js';
import type { HttpPortForwarding } from '../services/http-port-forwarding.service.js';

// The upkeep of HTTP from the internet: recreate the router rule and follow a changed
// public address. A failure leaves the rule as it is and shows on the panel.
export class MaintainHttpInternetAccess implements MaintainHttpInternetAccessUseCase {
    constructor(
        private readonly store: HttpInternetAccessStore,
        private readonly forwarding: HttpPortForwarding,
        private readonly clock: Clock,
    ) {}

    async execute(): Promise<RuleUpkeepOutcome> {
        const access = await this.store.read();

        if (access.phase !== 'open') {
            return { rule: 'none' };
        }

        const outcome = await this.forwarding.refresh(access).then(
            (kept): RuleUpkeepOutcome =>
                kept.outcome === 'failed'
                    ? { rule: 'failed', reason: kept.reason }
                    : { rule: 'kept', address: kept.address, problem: null },
            (): RuleUpkeepOutcome => {
                access.upkeepFailed('setup-failed', this.clock.now());

                return { rule: 'failed', reason: 'setup-failed' };
            },
        );

        await this.store.save(access);

        return outcome;
    }
}
