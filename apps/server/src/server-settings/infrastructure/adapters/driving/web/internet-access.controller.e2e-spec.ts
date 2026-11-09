import type {
    InternetAccessStatus,
    ServerStatus,
} from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generate } from 'selfsigned';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
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

// Starts a setup and waits for its background steps.
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
            new TlsSettings({ enabled: true, port: 3443, hasCertificate: true }),
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
            new TlsSettings({ enabled: false, port: 3443, hasCertificate: true }),
            { chain: 'saved', key: 'saved' },
        );

        const response = await client.call('/server-settings/internet-access', 'POST', {
            replaceCertificate: true,
        });

        expect(response.status).toBe(202);
    });
    it('starts the setup with the domain name', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<InternetAccessStatus>(
            '/server-settings/internet-access',
            'POST',
            { domain: 'Home.Example.fr' },
        );

        expect([response.status, response.body.phase, response.body.domain]).toEqual([
            202,
            'setting-up',
            'home.example.fr',
        ]);
    });
    it('rejects an invalid domain name', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/internet-access', 'POST', {
            domain: 'https://home.example.fr',
        });

        expect([response.status, response.body]).toEqual([
            400,
            expect.objectContaining({ reason: 'domain-name-invalid' }),
        ]);
    });
    it('rejects a domain name that is not text', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/internet-access', 'POST', {
            domain: 42,
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
        ]).toEqual(['active', 'https://' + publicAddress, publicAddress]);
    });
    it('switches HTTPS on with the issued certificate', async () => {
        const client = await app.authenticatedClient(admin);

        await setUp(client);

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([
            response.body.configured.tls,
            app.dependencies.internetAccess.https.installed,
        ]).toEqual([
            { enabled: true, port: 3443, hasCertificate: true },
            [{ port: 3443, chain: 'chain for ' + publicAddress }],
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
                internalPort: 3443,
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
    it('gives the domain name as the address once the certificate is in use', async () => {
        const client = await app.authenticatedClient(admin);

        await client.call('/server-settings/internet-access', 'POST', {
            domain: 'home.example.fr',
        });
        await app.dependencies.internetAccess.background.settled();

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([
            response.body.internetAccess.phase,
            response.body.internetAccess.origin,
            response.body.internetAccess.certificate?.address,
            app.dependencies.internetAccess.authority.subjects,
        ]).toEqual([
            'active',
            'https://home.example.fr',
            'home.example.fr',
            [{ kind: 'domain', name: 'home.example.fr' }],
        ]);
    });
    it('explains a domain name that points elsewhere', async () => {
        const client = await app.authenticatedClient(admin);

        app.dependencies.internetAccess.resolver.answer = ['82.66.118.77'];
        await client.call('/server-settings/internet-access', 'POST', {
            domain: 'home.example.fr',
        });
        await app.dependencies.internetAccess.background.settled();

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([
            response.body.internetAccess.phase,
            response.body.internetAccess.failure?.reason,
            response.body.internetAccess.domain,
        ]).toEqual(['off', 'domain-mismatch', 'home.example.fr']);
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
        ]).toEqual([200, 'off', [{ externalPort: 443, internalPort: 3443 }]]);
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
            port: 3443,
        });

        expect([response.status, response.body]).toEqual([
            409,
            expect.objectContaining({ reason: 'internet-access-on' }),
        ]);
    });
});
