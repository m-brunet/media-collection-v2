import type { PublicAddressProbe } from '../../../../application/ports/driven/public-address-probe.interface.js';

// Asks a "what is my IP" service; it only learns the home's public address.
export class HttpPublicAddressProbe implements PublicAddressProbe {
    static readonly ipify = 'https://api.ipify.org';
    private static readonly timeout = 5000;

    constructor(private readonly address: string = HttpPublicAddressProbe.ipify) {}

    async current(): Promise<string | null> {
        try {
            const response = await fetch(this.address, {
                signal: AbortSignal.timeout(HttpPublicAddressProbe.timeout),
            });
            const text = (await response.text()).trim();

            return response.ok && /^\d{1,3}(\.\d{1,3}){3}$/.test(text) ? text : null;
        } catch {
            return null;
        }
    }
}
