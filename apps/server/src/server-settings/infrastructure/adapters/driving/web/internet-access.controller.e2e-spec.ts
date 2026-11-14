import type {
    InternetAccessStatus,
    ServerStatus,
} from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generate } from 'selfsigned';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { DomainName } from '../../../../domain/value-objects/domain-name.value-object.js';
import { TlsSettings } from '../../../../domain/value-objects/tls-settings.value-object.js';

let app: TestApp;
const admin = new UserFixture({ username: 'administrator', role: 'admin' });
const member = new UserFixture({ username: 'member' });
const publicAddress = '82.66.118.204';

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([admin, member]);
});
afterEach(async () => {
    await app?.teardown();
});

async function setUp(client: Awaited<ReturnType<TestApp['authenticatedClient']>>) {
    await client.call('/server-settings/internet-access', 'POST', {});
    await app.dependencies.internetAccess.background.settled();
}

describe('POST /api/server-settings/internet-access', () => {
    it('answers at once while the setup looks for the router', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<InternetAccessStatus>(
            '/server-settings/internet-access',
            'POST',
            {},
        );

        expect([response.status, response.body.phase, response.body.step]).toEqual([
            202,
            'setting-up',
            'router',
        ]);
    });
    it('records the request in the technical audit log', async () => {
        const client = await app.authenticatedClient(admin);

        await client.call('/server-settings/internet-access', 'POST', {});

        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'server-settings.internet-access-set-up',
                outcome: 'successful',
            }),
        );
    });
    it('asks to confirm the replacement of a saved certificate', async () => {
        const client = await app.authenticatedClient(admin);
        const certificate = await generate([{ name: 'commonName', value: 'home' }], {
            keySize: 2048,
        });

        await app.dependencies.tls.save(
            new TlsSettings({ enabled: true, port: 34443, hasCertificate: true }),
            { chain: certificate.cert, key: certificate.private },
        );

        const response = await client.call('/server-settings/internet-access', 'POST', {});

        expect([response.status, response.body]).toEqual([
            409,
            expect.objectContaining({ reason: 'certificate-replacement-unconfirmed' }),
        ]);
    });
    it('replaces a saved certificate once confirmed', async () => {
        const client = await app.authenticatedClient(admin);

        await app.dependencies.tls.save(
            new TlsSettings({ enabled: false, port: 34443, hasCertificate: true }),
            { chain: 'saved', key: 'saved' },
        );

        const response = await client.call('/server-settings/internet-access', 'POST', {
            replaceCertificate: true,
        });

        expect(response.status).toBe(202);
    });
    it('refuses a new setup before the date Let’s Encrypt gave with a rate limit', async () => {
        const client = await app.authenticatedClient(admin);

        app.dependencies.internetAccess.authority.refusal = 'rate-limited';
        app.dependencies.internetAccess.authority.retryAfter = '2026-01-03T12:00:00.000Z';
        await setUp(client);

        const response = await client.call('/server-settings/internet-access', 'POST', {});

        expect([response.status, response.body]).toEqual([
            409,
            expect.objectContaining({ reason: 'rate-limited' }),
        ]);
    });
    it('rejects a domain name in the setup request', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/internet-access', 'POST', {
            domain: 'home.example.fr',
        });

        expect(response.status).toBe(400);
    });
    it('rejects an unknown field', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/internet-access', 'POST', {
            port: 443,
        });

        expect(response.status).toBe(400);
    });
    it('rejects an Owner', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/server-settings/internet-access', 'POST', {});

        expect(response.status).toBe(403);
    });
    it('rejects an unauthenticated request', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/server-settings/internet-access', 'POST', {});

        expect(response.status).toBe(401);
    });
});
describe('GET /api/server-settings after a setup', () => {
    it('gives the address phones open once the certificate is in use', async () => {
        const client = await app.authenticatedClient(admin);

        await setUp(client);

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([
            response.body.internetAccess.phase,
            response.body.internetAccess.origin,
            response.body.internetAccess.certificate?.address,
        ]).toEqual(['active', 'https://' + publicAddress + ':34443', publicAddress]);
    });
    it('switches HTTPS on with the issued certificate', async () => {
        const client = await app.authenticatedClient(admin);

        await setUp(client);

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([
            response.body.configured.tls,
            app.dependencies.internetAccess.https.installed,
        ]).toEqual([
            { enabled: true, port: 34443, hasCertificate: true },
            [{ port: 34443, chain: 'chain for ' + publicAddress }],
        ]);
    });
    it('gives the manual router rule when the router refuses the port', async () => {
        const client = await app.authenticatedClient(admin);

        app.dependencies.internetAccess.router.accepts = false;
        await setUp(client);

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([
            response.body.internetAccess.phase,
            response.body.internetAccess.manualRule,
        ]).toEqual([
            'waiting-for-port',
            {
                localAddress: '192.168.1.99',
                internalPort: 34443,
                externalPort: 443,
                protocol: 'TCP',
            },
        ]);
    });
    it('explains a provider sharing the address (CGNAT)', async () => {
        const client = await app.authenticatedClient(admin);

        app.dependencies.internetAccess.router.connection = {
            mapping: 'upnp',
            externalAddress: '100.72.0.4',
        };
        await setUp(client);

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([
            response.body.internetAccess.phase,
            response.body.internetAccess.failure?.reason,
        ]).toEqual(['off', 'cgnat']);
    });
    it('gives the saved domain name as the address once the certificate is in use', async () => {
        const client = await app.authenticatedClient(admin);

        await app.dependencies.internetAccess.domainName.save(
            DomainName.optional('home.example.fr'),
        );
        await setUp(client);

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([
            response.body.internetAccess.phase,
            response.body.internetAccess.origin,
            response.body.internetAccess.certificate?.address,
            app.dependencies.internetAccess.authority.subjects,
        ]).toEqual([
            'active',
            'https://home.example.fr:34443',
            'home.example.fr',
            [{ kind: 'domain', name: 'home.example.fr' }],
        ]);
    });
    it('gives Let’s Encrypt’s date and the estimate after a rate limit, without the history', async () => {
        const client = await app.authenticatedClient(admin);

        app.dependencies.internetAccess.authority.refusal = 'rate-limited';
        app.dependencies.internetAccess.authority.retryAfter = '2026-01-03T12:00:00.000Z';
        await setUp(client);

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([
            response.body.internetAccess.failure?.reason,
            response.body.internetAccess.retryAfter,
            response.body.internetAccess.allowances,
            'history' in response.body.internetAccess,
        ]).toEqual([
            'rate-limited',
            '2026-01-03T12:00:00.000Z',
            { certificates: { left: 5, nextAt: null }, checks: { left: 5, nextAt: null } },
            false,
        ]);
    });
    it('explains a saved domain name that no longer points to the connection', async () => {
        const client = await app.authenticatedClient(admin);

        await app.dependencies.internetAccess.domainName.save(
            DomainName.optional('home.example.fr'),
        );
        app.dependencies.internetAccess.resolver.answer = ['82.66.118.77'];
        await setUp(client);

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([
            response.body.internetAccess.phase,
            response.body.internetAccess.failure?.reason,
        ]).toEqual(['off', 'domain-mismatch']);
    });
});
describe('POST /api/server-settings/internet-access/check', () => {
    it('gets the certificate after a manual router rule', async () => {
        const client = await app.authenticatedClient(admin);

        app.dependencies.internetAccess.router.accepts = false;
        await setUp(client);

        const response = await client.call<InternetAccessStatus>(
            '/server-settings/internet-access/check',
            'POST',
        );

        expect([response.status, response.body.phase, response.body.step]).toEqual([
            202,
            'setting-up',
            'certificate',
        ]);
    });
    it('checks again while active after a failed check, keeping the certificate in use', async () => {
        const client = await app.authenticatedClient(admin);
        const store = app.dependencies.internetAccess.store;

        await setUp(client);
        const access = await store.read();

        access.upkeepFailed('not-reachable', new Date('2026-01-01T00:00:00.000Z'));
        await store.save(access);

        const response = await client.call<InternetAccessStatus>(
            '/server-settings/internet-access/check',
            'POST',
        );

        expect([
            response.status,
            response.body.phase,
            response.body.step,
            response.body.awaitingCheck,
        ]).toEqual([202, 'active', 'certificate', true]);
    });
    it('has nothing to check while internet access is off', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/internet-access/check', 'POST');

        expect([response.status, response.body]).toEqual([
            409,
            expect.objectContaining({ reason: 'nothing-to-check' }),
        ]);
    });
});
describe('DELETE /api/server-settings/internet-access', () => {
    it('turns internet access off and removes the router rule', async () => {
        const client = await app.authenticatedClient(admin);

        await setUp(client);

        const response = await client.call<InternetAccessStatus>(
            '/server-settings/internet-access',
            'DELETE',
        );

        expect([
            response.status,
            response.body.phase,
            app.dependencies.internetAccess.router.closed,
        ]).toEqual([200, 'off', [{ externalPort: 443, internalPort: 34443 }]]);
    });
    it('records the change in the technical audit log', async () => {
        const client = await app.authenticatedClient(admin);

        await setUp(client);

        await client.call('/server-settings/internet-access', 'DELETE');

        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'server-settings.internet-access-turned-off',
                outcome: 'successful',
            }),
        );
    });
    it('rejects an Owner', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/server-settings/internet-access', 'DELETE');

        expect(response.status).toBe(403);
    });
});
describe('PUT /api/server-settings while internet access is on', () => {
    it('refuses any HTTPS change', async () => {
        const client = await app.authenticatedClient(admin);

        await setUp(client);

        const response = await client.call('/server-settings', 'PUT', {
            enabled: false,
            port: 34443,
        });

        expect([response.status, response.body]).toEqual([
            409,
            expect.objectContaining({ reason: 'internet-access-on' }),
        ]);
    });
});
