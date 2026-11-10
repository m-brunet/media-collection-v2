import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import { HttpInternetAccess } from '../../domain/entities/http-internet-access.entity.js';
import type { HttpListener } from '../ports/driven/http-listener.interface.js';
import type { PortRule } from '../ports/driven/port-rule.interface.js';
import type { RouterRules, RuleUpkeep } from './router-rules.service.js';

// Opening, closing and the upkeep change the entity; the caller saves it.
export class HttpPortForwarding {
    constructor(
        private readonly rules: RouterRules,
        private readonly listener: HttpListener,
        private readonly clock: Clock,
    ) {}

    async open(access: HttpInternetAccess): Promise<void> {
        const now = this.clock.now();
        const search = await this.rules.find();

        if (!search.router) {
            if (search.publicAddress) {
                access.openedByHand(search.publicAddress, 'no-router', now);
            } else {
                access.refused('public-address-unknown', now);
            }

            return;
        }

        const router = search.router;

        if (!HttpInternetAccess.usable(router.externalAddress)) {
            access.refused(HttpInternetAccess.blockedReason(router.externalAddress), now);

            return;
        }

        if (await this.rules.open(this.rule())) {
            access.opened(router.mapping, router.externalAddress);
        } else {
            access.openedByHand(router.externalAddress, 'port-refused', now);
        }
    }

    async close(access: HttpInternetAccess, byHttps: boolean): Promise<void> {
        if (access.automatic) {
            await this.rules.close(this.rule());
        }

        access.close(byHttps);
    }

    async refresh(access: HttpInternetAccess): Promise<RuleUpkeep> {
        const kept = await this.rules.keep(this.rule(), !access.automatic);

        if (kept.outcome === 'failed') {
            access.upkeepFailed(kept.reason, this.clock.now());

            return kept;
        }

        if (kept.address !== access.publicAddress) {
            access.addressChanged(kept.address);
        }

        access.upkeepSucceeded();

        return kept;
    }

    private rule(): PortRule {
        const port = this.listener.port();

        return { externalPort: port, internalPort: port };
    }
}
