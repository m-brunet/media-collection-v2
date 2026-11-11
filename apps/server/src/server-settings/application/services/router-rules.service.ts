import type { RouterRuleFailureReason } from '../../domain/entities/internet-access.entity.js';
import { ConnectionClass } from '../../domain/value-objects/connection-class.value-object.js';
import type { PortRule } from '../ports/driven/port-rule.interface.js';
import type { PublicAddressProbe } from '../ports/driven/public-address-probe.interface.js';
import type { RouterConnection } from '../ports/driven/router-connection.interface.js';
import type { RouterGateway } from '../ports/driven/router-gateway.interface.js';

export type RouterSearch =
    | { router: RouterConnection }
    | { router: null; publicAddress: string | null };

export type RuleUpkeep =
    | { outcome: 'serving'; address: string }
    | {
          outcome: 'failed';
          reason: RouterRuleFailureReason;
      };

export class RouterRules {
    constructor(
        private readonly router: RouterGateway,
        private readonly probe: PublicAddressProbe,
    ) {}

    async find(): Promise<RouterSearch> {
        const router = await this.router.find();

        return router ? { router } : { router: null, publicAddress: await this.probe.current() };
    }

    async publicAddress(): Promise<string | null> {
        const search = await this.find();

        return search.router ? search.router.externalAddress : search.publicAddress;
    }

    open(rule: PortRule): Promise<boolean> {
        return this.router.open(rule);
    }

    close(rule: PortRule): Promise<void> {
        return this.router.close(rule);
    }

    async keep(rule: PortRule, byHand: boolean): Promise<RuleUpkeep> {
        const address = byHand ? await this.probe.current() : await this.reopen(rule);

        if (address === null) {
            return { outcome: 'failed', reason: byHand ? 'public-address-unknown' : 'no-router' };
        }

        if (address === 'refused') {
            return { outcome: 'failed', reason: 'port-refused' };
        }

        const connection = ConnectionClass.of(address);

        if (!connection.reachable) {
            return {
                outcome: 'failed',
                reason: connection.kind === 'cgnat' ? 'cgnat' : 'double-nat',
            };
        }

        return { outcome: 'serving', address: connection.address };
    }

    private async reopen(rule: PortRule): Promise<string | 'refused' | null> {
        const router = await this.router.find();

        if (!router) {
            return null;
        }

        return (await this.router.open(rule)) ? router.externalAddress : 'refused';
    }
}
