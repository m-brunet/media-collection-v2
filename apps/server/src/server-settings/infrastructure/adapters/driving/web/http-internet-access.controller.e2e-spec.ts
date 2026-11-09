import type {
    HttpInternetAccessStatus,
    ServerStatus,
} from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { HttpInternetAccess } from '../../../../domain/entities/http-internet-access.entity.js';
import { DomainName } from '../../../../domain/value-objects/domain-name.value-object.js';

let app: TestApp;
const admin = new UserFixture({ username: 'administrator', role: 'admin' });
const member = new UserFixture({ username: 'member' });
const publicAddress = '82.66.118.204';
const httpRule = { externalPort: 34345, internalPort: 34345 };

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([admin, member]);
});
afterEach(async () => {
    await app?.teardown();
});

async function savedOpen() {
    const access = HttpInternetAccess.off();

    access.opened('upnp', publicAddress);
    await app.dependencies.internetAccess.http.save(access);
}

describe('POST /api/server-settings/internet-access/http', () => {
    it('opens the HTTP port on the router and gives the HTTP address', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<HttpInternetAccessStatus>(
            '/server-settings/internet-access/http',
            'POST',
        );

        expect([
            response.status,
            response.body.phase,
            response.body.origin,
            app.dependencies.internetAccess.router.opened,
        ]).toEqual([201, 'open', 'http://' + publicAddress + ':34345', [httpRule]]);
    });
    it('gives the HTTP address on the saved domain name', async () => {
        const client = await app.authenticatedClient(admin);

        await app.dependencies.internetAccess.domainName.save(
            DomainName.optional('home.example.fr'),
        );

        const response = await client.call<HttpInternetAccessStatus>(
            '/server-settings/internet-access/http',
            'POST',
        );

        expect(response.body.origin).toBe('http://home.example.fr:34345');
    });
    it('gives the rule to add by hand when the router refuses it', async () => {
        const client = await app.authenticatedClient(admin);

        app.dependencies.internetAccess.router.accepts = false;

        const response = await client.call<HttpInternetAccessStatus>(
            '/server-settings/internet-access/http',
            'POST',
        );

        expect([response.body.mapping, response.body.manualRule]).toEqual([
            'manual',
            {
                localAddress: '192.168.1.99',
                internalPort: 34345,
                externalPort: 34345,
                protocol: 'TCP',
            },
        ]);
    });
    it('explains a provider sharing the address', async () => {
        const client = await app.authenticatedClient(admin);

        app.dependencies.internetAccess.router.connection = {
            mapping: 'upnp',
            externalAddress: '100.72.0.4',
        };

        const response = await client.call<HttpInternetAccessStatus>(
            '/server-settings/internet-access/http',
            'POST',
        );

        expect([response.body.phase, response.body.failure?.reason]).toEqual(['off', 'cgnat']);
    });
    it('refuses while HTTPS works from the internet', async () => {
        const client = await app.authenticatedClient(admin);

        await client.call('/server-settings/internet-access', 'POST', {});
        await app.dependencies.internetAccess.background.settled();

        const response = await client.call('/server-settings/internet-access/http', 'POST');

        expect([response.status, response.body]).toEqual([
            409,
            expect.objectContaining({ reason: 'https-active' }),
        ]);
    });
    it('records the opening in the technical audit log', async () => {
        const client = await app.authenticatedClient(admin);

        await client.call('/server-settings/internet-access/http', 'POST');

        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'server-settings.http-internet-access-opened',
                outcome: 'successful',
            }),
        );
    });
    it('rejects an Owner', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/server-settings/internet-access/http', 'POST');

        expect(response.status).toBe(403);
    });
    it('rejects an unauthenticated request', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/server-settings/internet-access/http', 'POST');

        expect(response.status).toBe(401);
    });
});

describe('DELETE /api/server-settings/internet-access/http', () => {
    it('closes HTTP to the internet and removes the router rule', async () => {
        const client = await app.authenticatedClient(admin);

        await savedOpen();

        const response = await client.call<HttpInternetAccessStatus>(
            '/server-settings/internet-access/http',
            'DELETE',
        );

        expect([
            response.status,
            response.body.phase,
            app.dependencies.internetAccess.router.closed,
        ]).toEqual([200, 'off', [httpRule]]);
    });
    it('records the closing in the technical audit log', async () => {
        const client = await app.authenticatedClient(admin);

        await savedOpen();

        await client.call('/server-settings/internet-access/http', 'DELETE');

        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'server-settings.http-internet-access-closed',
                outcome: 'successful',
            }),
        );
    });
    it('rejects an Owner', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/server-settings/internet-access/http', 'DELETE');

        expect(response.status).toBe(403);
    });
});

describe('GET /api/server-settings with HTTP open to the internet', () => {
    it('gives the HTTP internet access', async () => {
        const client = await app.authenticatedClient(admin);

        await savedOpen();

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([
            response.body.httpInternetAccess.phase,
            response.body.httpInternetAccess.origin,
        ]).toEqual(['open', 'http://' + publicAddress + ':34345']);
    });
    it('shows HTTP closed by a working HTTPS setup', async () => {
        const client = await app.authenticatedClient(admin);

        await savedOpen();
        await client.call('/server-settings/internet-access', 'POST', {});
        await app.dependencies.internetAccess.background.settled();

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([
            response.body.internetAccess.phase,
            response.body.httpInternetAccess.phase,
            response.body.httpInternetAccess.closedByHttps,
        ]).toEqual(['active', 'off', true]);
    });
});

describe('PUT /api/server-settings/http while HTTP is open to the internet', () => {
    it('refuses another HTTP port', async () => {
        const client = await app.authenticatedClient(admin);

        await savedOpen();

        const response = await client.call('/server-settings/http', 'PUT', { port: 36000 });

        expect([response.status, response.body]).toEqual([
            409,
            expect.objectContaining({ reason: 'internet-access-on' }),
        ]);
    });
});
