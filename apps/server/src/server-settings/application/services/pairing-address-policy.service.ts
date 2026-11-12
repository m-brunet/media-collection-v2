import type { PairingAddresses } from '../../../identity/application/ports/driven/pairing-addresses.interface.js';
import type { DomainNameReader } from '../ports/driven/domain-name-reader.interface.js';
import type { HttpInternetAccessReader } from '../ports/driven/http-internet-access-reader.interface.js';
import type { HttpListener } from '../ports/driven/http-listener.interface.js';
import type { InternetAccessReader } from '../ports/driven/internet-access-reader.interface.js';
import type { ListenerAddressReader } from '../ports/driven/listener-address-reader.interface.js';

export class PairingAddressPolicy implements PairingAddresses {
    private static readonly loopbackPrefixes = ['http://127.', 'http://localhost', 'http://[::1]'];

    constructor(
        private readonly listeners: ListenerAddressReader,
        private readonly internetAccess: InternetAccessReader,
        private readonly httpInternetAccess: HttpInternetAccessReader,
        private readonly names: DomainNameReader,
        private readonly listener: HttpListener,
    ) {}

    async accepts(address: string): Promise<boolean> {
        const httpInternet = (await this.httpInternetAccess.read()).origin(
            await this.names.read(),
            this.listener.port(),
        );

        if (address === httpInternet) {
            return false;
        }

        if (address === (await this.internetAccess.read()).origin) {
            return true;
        }

        return (
            !PairingAddressPolicy.loopbackPrefixes.some((prefix) => address.startsWith(prefix)) &&
            (await this.listeners.current()).includes(address)
        );
    }
}
