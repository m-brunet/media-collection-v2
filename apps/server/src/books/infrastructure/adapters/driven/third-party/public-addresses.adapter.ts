import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import type { AddressPolicy } from './http-cover-downloader.adapter.js';

// Resolves a host name to all its IP addresses.
export type HostResolver = (hostname: string) => Promise<string[]>;

const resolveAll: HostResolver = async (hostname) =>
    (await lookup(hostname, { all: true })).map(({ address }) => address);

// Only addresses on the public internet: an image address someone pastes must never make the
// server reach into the home network (router, NAS, the server itself). Every address a name
// resolves to must be public; a name that cannot be resolved is refused.
export class PublicAddresses implements AddressPolicy {
    private static readonly reserved = PublicAddresses.ranges();

    constructor(private readonly resolve: HostResolver = resolveAll) {}

    async allows(url: URL): Promise<boolean> {
        const hostname = url.hostname.replace(/^\[|\]$/g, '');

        try {
            const addresses = isIP(hostname) ? [hostname] : await this.resolve(hostname);

            return (
                addresses.length > 0 &&
                addresses.every((address) => PublicAddresses.public(address))
            );
        } catch {
            // Justified: a name that does not resolve cannot be checked, so it is refused.
            return false;
        }
    }

    private static public(address: string): boolean {
        const family = isIP(address);

        if (family === 0) {
            return false;
        }

        // An IPv4 address written as IPv6 ("::ffff:192.168.1.10") is checked as IPv4.
        const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];

        if (mapped) {
            return !PublicAddresses.reserved.check(mapped, 'ipv4');
        }

        return !PublicAddresses.reserved.check(address, family === 4 ? 'ipv4' : 'ipv6');
    }

    // Local, private, shared, link-local, documentation, multicast and reserved ranges.
    private static ranges(): BlockList {
        const list = new BlockList();

        for (const [network, prefix] of [
            ['0.0.0.0', 8],
            ['10.0.0.0', 8],
            ['100.64.0.0', 10],
            ['127.0.0.0', 8],
            ['169.254.0.0', 16],
            ['172.16.0.0', 12],
            ['192.0.0.0', 24],
            ['192.0.2.0', 24],
            ['192.168.0.0', 16],
            ['198.18.0.0', 15],
            ['198.51.100.0', 24],
            ['203.0.113.0', 24],
            ['224.0.0.0', 4],
            ['240.0.0.0', 4],
        ] as const) {
            list.addSubnet(network, prefix, 'ipv4');
        }

        for (const [network, prefix] of [
            ['::', 128],
            ['::1', 128],
            ['64:ff9b::', 96],
            ['100::', 64],
            ['2001:db8::', 32],
            ['fc00::', 7],
            ['fe80::', 10],
            ['ff00::', 8],
        ] as const) {
            list.addSubnet(network, prefix, 'ipv6');
        }

        return list;
    }
}
