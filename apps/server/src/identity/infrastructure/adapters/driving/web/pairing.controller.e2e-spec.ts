import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import type { Client } from '../../../../../../../../tests/api/client.js';

let app: TestApp;
const admin = new UserFixture({ username: 'administrator', role: 'admin' });
const owner = new UserFixture({ username: 'owner-account', role: 'owner' });
const guest = new UserFixture({ username: 'guest-account', role: 'guest' });
const home = 'http://192.168.1.20:34345';
const tailscale = 'http://100.101.102.103:34345';
const httpInternet = 'http://82.66.118.204:34345';

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([admin, owner, guest]);
    app.listenOn(home);
    app.listenOn(tailscale);
    app.listenOn(httpInternet);
});
afterEach(async () => {
    await app?.teardown();
});

async function showCode(address = home): Promise<string> {
    const client = await app.authenticatedClient(admin);
    const response = await client.call<{ link: string }>('/auth/pairing-codes', 'POST', {
        address,
    });

    return response.body.link.split('#pair=')[1]!;
}

async function phone(): Promise<Client> {
    const client = app.client();

    await client.prepare();

    return client;
}

describe('POST /api/auth/pairing-codes', () => {
    it('gives the Leaf link of a home network address with a code after the hash sign', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/auth/pairing-codes', 'POST', { address: home });

        expect(response.status).toBe(201);
        expect(response.body.link).toMatch(
            /^http:\/\/192\.168\.1\.20:34345\/leaf\/#pair=[A-Za-z0-9_-]{43}$/,
        );
        expect(response.body.expiresAt).toBe('2026-01-01T00:02:00.000Z');
        expect(response.headers['cache-control']).toBe('no-store');
    });
    it('gives a link for a Tailscale address', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/auth/pairing-codes', 'POST', { address: tailscale });

        expect(response.status).toBe(201);
        expect(response.body.link).toContain(tailscale + '/leaf/#pair=');
    });
    it('refuses the HTTP internet address', async () => {
        await app.openHttpInternetAccess();
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/auth/pairing-codes', 'POST', {
            address: httpInternet,
        });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('pairing-address-ineligible');
    });
    it('refuses an address the server does not listen on', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/auth/pairing-codes', 'POST', {
            address: 'http://attacker.invalid:34345',
        });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('pairing-address-ineligible');
    });
    it('refuses an Owner', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/auth/pairing-codes', 'POST', { address: home });

        expect(response.status).toBe(403);
    });
    it('refuses a Guest', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/auth/pairing-codes', 'POST', { address: home });

        expect(response.status).toBe(403);
    });
    it('rejects unauthenticated access', async () => {
        const client = await phone();

        const response = await client.call('/auth/pairing-codes', 'POST', { address: home });

        expect(response.status).toBe(401);
    });
    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call(
            '/auth/pairing-codes',
            'POST',
            { address: home },
            { csrf: false },
        );

        expect(response.status).toBe(403);
    });
    it('records the creation without the code', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<{ link: string }>('/auth/pairing-codes', 'POST', {
            address: home,
        });

        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'authentication.pairing-code-created',
                outcome: 'successful',
                actorId: admin.id,
                after: { address: home, expiresAt: '2026-01-01T00:02:00.000Z' },
            }),
        );
        expect(await app.dependencies.audit.text()).not.toContain(
            response.body.link.split('#pair=')[1],
        );
    });
});
describe('POST /api/auth/pair', () => {
    it('signs the phone in as the Admin with a session cookie', async () => {
        const code = await showCode();
        const client = await phone();

        const response = await client.call('/auth/pair', 'POST', { code });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            id: admin.id,
            username: admin.username,
            role: 'admin',
            mustChangePassword: false,
            language: null,
        });
        expect(
            response.headers['set-cookie']!.find((cookie) => cookie.startsWith('app_auth=')),
        ).toContain('HttpOnly');
    });
    it('opens a normal session for the Admin', async () => {
        const code = await showCode();
        const client = await phone();

        await client.call('/auth/pair', 'POST', { code });

        const response = await client.call('/auth/me');

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(admin.id);
    });
    it('refuses a code used before', async () => {
        const code = await showCode();

        await (await phone()).call('/auth/pair', 'POST', { code });
        const client = await phone();

        const response = await client.call('/auth/pair', 'POST', { code });

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({
            reason: 'pairing-code-expired',
            message: 'This QR code has expired. Show it again on the computer.',
        });
        expect(client.cookies.has('app_auth')).toBe(false);
    });
    it('refuses a code after 2 minutes', async () => {
        const code = await showCode();

        app.advance(120_000);
        const client = await phone();

        const response = await client.call('/auth/pair', 'POST', { code });

        expect(response.status).toBe(401);
        expect(response.body.reason).toBe('pairing-code-expired');
    });
    it('accepts a code just before 2 minutes', async () => {
        const code = await showCode();

        app.advance(119_000);
        const client = await phone();

        const response = await client.call('/auth/pair', 'POST', { code });

        expect(response.status).toBe(200);
    });
    it('refuses a code replaced by a newer one', async () => {
        const code = await showCode();

        await showCode();
        const client = await phone();

        const response = await client.call('/auth/pair', 'POST', { code });

        expect(response.status).toBe(401);
    });
    it('refuses a code shown before a password change', async () => {
        const code = await showCode();
        const computer = await app.authenticatedClient(admin);

        await computer.call('/account/password', 'PATCH', {
            currentPassword: admin.password,
            password: 'a-brand-new-password',
        });
        const client = await phone();

        const response = await client.call('/auth/pair', 'POST', { code });

        expect(response.status).toBe(401);
        expect(response.body.reason).toBe('pairing-code-expired');
    });
    it('refuses an unknown code', async () => {
        const client = await phone();

        const response = await client.call('/auth/pair', 'POST', { code: 'A'.repeat(43) });

        expect(response.status).toBe(401);
        expect(response.body.reason).toBe('pairing-code-expired');
    });
    it('rejects a malformed code', async () => {
        const client = await phone();

        const response = await client.call('/auth/pair', 'POST', { code: 'short' });

        expect(response.status).toBe(400);
    });
    it('rejects missing CSRF', async () => {
        const code = await showCode();
        const client = await phone();

        const response = await client.call('/auth/pair', 'POST', { code }, { csrf: false });

        expect(response.status).toBe(403);
    });
    it('rejects a foreign Origin', async () => {
        const code = await showCode();
        const client = await phone();

        const response = await client.call(
            '/auth/pair',
            'POST',
            { code },
            { origin: 'http://attacker.invalid' },
        );

        expect(response.status).toBe(403);
    });
    it('throttles attempts after the allowed limit like the login', async () => {
        const client = await phone();

        for (let attempt = 0; attempt < 30; attempt++) {
            await client.call('/auth/pair', 'POST', { code: 'B'.repeat(43) });
        }

        const response = await client.call('/auth/pair', 'POST', { code: 'B'.repeat(43) });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain('Too many');
    });
    it('records the sign-in without the code', async () => {
        const code = await showCode();
        const client = await phone();

        await client.call('/auth/pair', 'POST', { code });

        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'authentication.signed-in-with-pairing-code',
                outcome: 'successful',
                actorId: admin.id,
                subjectId: admin.id,
            }),
        );
        expect(await app.dependencies.audit.text()).not.toContain(code);
    });
    it('records a refused code as a failed sign-in', async () => {
        const client = await phone();

        await client.call('/auth/pair', 'POST', { code: 'C'.repeat(43) });

        expect(await app.dependencies.audit.entries()).toEqual([
            expect.objectContaining({
                category: 'authentication.signed-in-with-pairing-code',
                outcome: 'failed',
                actorId: null,
                failure: 'unauthorized:pairing-code-expired',
            }),
        ]);
    });
});
