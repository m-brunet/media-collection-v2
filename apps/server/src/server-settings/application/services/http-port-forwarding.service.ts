import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import { HttpInternetAccess } from '../../domain/entities/http-internet-access.entity.js';
import type { HttpSettingsReader } from '../ports/driven/http-settings-reader.interface.js';
import type { PortRule } from '../ports/driven/port-rule.interface.js';
import type { PublicAddressProbe } from '../ports/driven/public-address-probe.interface.js';
import type { RouterGateway } from '../ports/driven/router-gateway.interface.js';

// The router rule of HTTP from the internet: the HTTP port, from outside to this computer. Opening,
// closing and the upkeep change the entity; the caller saves it.
export class HttpPortForwarding {
    constructor(
        private readonly router: RouterGateway,
        private readonly probe: PublicAddressProbe,
        private readonly http: HttpSettingsReader,
        private readonly clock: Clock,
    ) {}

    async open(access: HttpInternetAccess): Promise<void> {
        const now = this.clock.now();
        const router = await this.router.find();

        if (!router) {
            const address = await this.probe.current();

            if (address) {
                access.openedByHand(address, 'no-router', now);
            } else {
                access.refused('public-address-unknown', now);
            }

            return;
        }

        if (!HttpInternetAccess.usable(router.externalAddress)) {
            access.refused(HttpInternetAccess.blockedReason(router.externalAddress), now);

            return;
        }

        if (await this.router.open(await this.rule())) {
            access.opened(router.mapping, router.externalAddress);
        } else {
            access.openedByHand(router.externalAddress, 'port-refused', now);
        }
    }

    // `byHttps`: a working HTTPS setup closes it, not the Admin.
    async close(access: HttpInternetAccess, byHttps: boolean): Promise<void> {
        if (access.automatic) {
            await this.router.close(await this.rule());
        }

        access.close(byHttps);
    }

    // Recreating the rule follows a new local address and survives a router restart; a rule by
    // hand only follows the public address.
    async refresh(access: HttpInternetAccess): Promise<void> {
        if (access.phase !== 'open') {
            return;
        }

        const now = this.clock.now();
        const address = access.automatic ? await this.reopen() : await this.probe.current();

        if (address === null) {
            access.upkeepFailed(access.automatic ? 'no-router' : 'public-address-unknown', now);
        } else if (address === 'refused') {
            access.upkeepFailed('port-refused', now);
        } else if (!HttpInternetAccess.usable(address)) {
            access.upkeepFailed(HttpInternetAccess.blockedReason(address), now);
        } else {
            if (address !== access.publicAddress) {
                access.addressChanged(address);
            }

            access.upkeepSucceeded();
        }
    }

    private async reopen(): Promise<string | 'refused' | null> {
        const router = await this.router.find();

        if (!router) {
            return null;
        }

        return (await this.router.open(await this.rule())) ? router.externalAddress : 'refused';
    }

    // The external port is the HTTP port itself (1024-65535).
    private async rule(): Promise<PortRule> {
        const { port } = await this.http.read();

        return { externalPort: port, internalPort: port };
    }
}
