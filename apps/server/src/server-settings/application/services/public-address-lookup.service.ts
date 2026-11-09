import type { PublicAddressProbe } from '../ports/driven/public-address-probe.interface.js';
import type { RouterGateway } from '../ports/driven/router-gateway.interface.js';

// The home connection's public IPv4 address: the router's answer when it speaks UPnP, otherwise
// the public "what is my IP" service; null when neither can tell.
export class PublicAddressLookup {
    constructor(
        private readonly router: RouterGateway,
        private readonly probe: PublicAddressProbe,
    ) {}

    async current(): Promise<string | null> {
        const router = await this.router.find();

        return router ? router.externalAddress : this.probe.current();
    }
}
