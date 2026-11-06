import { describe, expect, it } from 'vitest';
import { PublicAddresses } from './public-addresses.adapter.js';

function resolving(...addresses: string[]) {
    return new PublicAddresses(async () => addresses);
}

describe('PublicAddresses', () => {
    it('allows a name resolving to public addresses', async () => {
        const allowed = await resolving('151.101.1.69', '2a04:4e42::645').allows(
            new URL('https://images.example/cover.jpg'),
        );

        expect(allowed).toBe(true);
    });

    it('refuses a name resolving inside the home network', async () => {
        const allowed = await resolving('192.168.1.20').allows(
            new URL('http://nas.local/cover.jpg'),
        );

        expect(allowed).toBe(false);
    });

    it('refuses a name with one private address among public ones', async () => {
        const allowed = await resolving('151.101.1.69', '10.0.0.5').allows(
            new URL('https://images.example/cover.jpg'),
        );

        expect(allowed).toBe(false);
    });

    it('refuses the server itself', async () => {
        const allowed = await resolving('127.0.0.1').allows(new URL('http://localhost:34345/'));

        expect(allowed).toBe(false);
    });

    it('refuses a private address written directly', async () => {
        const allowed = await resolving().allows(new URL('http://172.16.4.1/cover.jpg'));

        expect(allowed).toBe(false);
    });

    it('refuses a local IPv6 address written directly', async () => {
        const allowed = await resolving().allows(new URL('http://[::1]/cover.jpg'));

        expect(allowed).toBe(false);
    });

    it('refuses a private IPv4 address written as IPv6', async () => {
        const allowed = await resolving('::ffff:192.168.1.20').allows(
            new URL('https://images.example/cover.jpg'),
        );

        expect(allowed).toBe(false);
    });

    it('refuses a name that does not resolve', async () => {
        const policy = new PublicAddresses(async () => {
            throw new Error('ENOTFOUND');
        });

        const allowed = await policy.allows(new URL('https://unknown.example/cover.jpg'));

        expect(allowed).toBe(false);
    });
});
