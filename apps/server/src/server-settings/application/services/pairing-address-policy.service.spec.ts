import { describe, expect, it } from 'vitest';
import {
    FixedHttpListener,
    InternetAccessDoubles,
    MemoryDomainNameStore,
    MemoryHttpInternetAccessStore,
    MemoryInternetAccessStore,
} from '../testing/internet-access-doubles.test-support.js';
import { PairingAddressPolicy } from './pairing-address-policy.service.js';

const listening = [
    'http://127.0.0.1:3000',
    'http://192.168.1.20:3000',
    'http://100.101.102.103:3000',
    'http://82.66.118.204:3000',
    'http://library.example.org:3000',
];

function policy(
    options: { httpOpen?: boolean; httpsActive?: boolean; domainName?: string | null } = {},
): PairingAddressPolicy {
    return new PairingAddressPolicy(
        { current: async () => listening },
        new MemoryInternetAccessStore(
            options.httpsActive ? InternetAccessDoubles.active() : undefined,
        ),
        new MemoryHttpInternetAccessStore(
            options.httpOpen ? InternetAccessDoubles.httpOpen() : undefined,
        ),
        new MemoryDomainNameStore(options.domainName ?? null),
        new FixedHttpListener(3000),
    );
}

describe('PairingAddressPolicy', () => {
    it('accepts a home network address the server listens on', async () => {
        const subject = policy();

        const result = await subject.accepts('http://192.168.1.20:3000');

        expect(result).toBe(true);
    });
    it('accepts a Tailscale address the server listens on', async () => {
        const subject = policy();

        const result = await subject.accepts('http://100.101.102.103:3000');

        expect(result).toBe(true);
    });
    it('accepts the HTTPS internet address while it is active', async () => {
        const subject = policy({ httpsActive: true });

        const result = await subject.accepts('https://82.66.118.204');

        expect(result).toBe(true);
    });
    it('refuses the HTTPS internet address while it is not active', async () => {
        const subject = policy();

        const result = await subject.accepts('https://82.66.118.204');

        expect(result).toBe(false);
    });
    it('refuses the HTTP internet address', async () => {
        const subject = policy({ httpOpen: true });

        const result = await subject.accepts('http://82.66.118.204:3000');

        expect(result).toBe(false);
    });
    it('refuses the HTTP internet address on the domain name', async () => {
        const subject = policy({ httpOpen: true, domainName: 'library.example.org' });

        const result = await subject.accepts('http://library.example.org:3000');

        expect(result).toBe(false);
    });
    it('refuses the loopback address', async () => {
        const subject = policy();

        const result = await subject.accepts('http://127.0.0.1:3000');

        expect(result).toBe(false);
    });
    it('refuses an address the server does not listen on', async () => {
        const subject = policy();

        const result = await subject.accepts('http://attacker.example:3000');

        expect(result).toBe(false);
    });
});
