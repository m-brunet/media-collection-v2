import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { HttpInternetAccessStore } from '../ports/driven/http-internet-access-store.interface.js';
import type { MaintainHttpInternetAccessUseCase } from '../ports/driving/maintain-http-internet-access-use-case.interface.js';
import type { HttpPortForwarding } from '../services/http-port-forwarding.service.js';

// The hourly upkeep of HTTP from the internet: recreate the router rule and follow a changed
// public address. A failure leaves the rule as it is and shows on the panel.
export class MaintainHttpInternetAccess implements MaintainHttpInternetAccessUseCase {
    constructor(
        private readonly store: HttpInternetAccessStore,
        private readonly forwarding: HttpPortForwarding,
        private readonly clock: Clock,
    ) {}

    async execute(): Promise<void> {
        const access = await this.store.read();

        if (access.phase !== 'open') {
            return;
        }

        await this.forwarding
            .refresh(access)
            .catch(() => access.upkeepFailed('setup-failed', this.clock.now()));
        await this.store.save(access);
    }
}
