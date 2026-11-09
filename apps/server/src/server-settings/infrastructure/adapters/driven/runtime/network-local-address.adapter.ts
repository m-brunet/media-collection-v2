import { networkInterfaces } from 'node:os';
import type { LocalAddressReader } from '../../../../application/ports/driven/local-address-reader.interface.js';

// The computer's home network address: a private IPv4 address (VPN addresses such as Tailscale's
// 100.64/10 range are not the home network).
export class NetworkLocalAddress implements LocalAddressReader {
    async current(): Promise<string | null> {
        const addresses = Object.values(networkInterfaces())
            .flatMap((entries) => entries ?? [])
            .filter((entry) => entry.family === 'IPv4' && !entry.internal)
            .map((entry) => entry.address);

        return addresses.find((address) => NetworkLocalAddress.homeNetwork(address)) ?? null;
    }

    private static homeNetwork(address: string): boolean {
        const [first, second] = address.split('.').map(Number);

        return (
            first === 10 ||
            (first === 192 && second === 168) ||
            (first === 172 && second! >= 16 && second! <= 31)
        );
    }
}
