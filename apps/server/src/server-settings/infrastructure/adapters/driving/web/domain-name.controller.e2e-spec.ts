import type { ServerStatus } from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { DomainName } from '../../../../domain/value-objects/domain-name.value-object.js';

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

describe('PUT /api/server-settings/domain-name', () => {
    it('saves a domain name that points to this connection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/domain-name', 'PUT', {
            domain: 'Home.Example.fr',
        });

        expect([
            response.status,
            response.body,
            await app.dependencies.internetAccess.domainName.read(),
        ]).toEqual([200, { domain: 'home.example.fr' }, 'home.example.fr']);
    });
    it('removes the domain name', async () => {
        const client = await app.authenticatedClient(admin);

        await app.dependencies.internetAccess.domainName.save(
            DomainName.optional('home.example.fr'),
        );

        const response = await client.call('/server-settings/domain-name', 'PUT', { domain: null });

        expect([response.status, response.body]).toEqual([200, { domain: null }]);
    });
    it('refuses a domain name that points elsewhere and gives the public address', async () => {
        const client = await app.authenticatedClient(admin);

        app.dependencies.internetAccess.resolver.answer = ['82.66.118.77'];

        const response = await client.call('/server-settings/domain-name', 'PUT', {
            domain: 'home.example.fr',
        });

        expect([response.status, response.body]).toEqual([
            400,
            expect.objectContaining({
                reason: 'domain-mismatch',
                details: { publicAddress },
            }),
        ]);
    });
    it('refuses a domain name without an address', async () => {
        const client = await app.authenticatedClient(admin);

        app.dependencies.internetAccess.resolver.answer = [];

        const response = await client.call('/server-settings/domain-name', 'PUT', {
            domain: 'home.example.fr',
        });

        expect([response.status, response.body]).toEqual([
            400,
            expect.objectContaining({ reason: 'domain-unresolved' }),
        ]);
    });
    it('refuses an invalid domain name', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/domain-name', 'PUT', {
            domain: 'https://home.example.fr',
        });

        expect([response.status, response.body]).toEqual([
            400,
            expect.objectContaining({ reason: 'domain-name-invalid' }),
        ]);
    });
    it('rejects a missing domain field', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/domain-name', 'PUT', {});

        expect(response.status).toBe(400);
    });
    it('records the change in the technical audit log', async () => {
        const client = await app.authenticatedClient(admin);

        await client.call('/server-settings/domain-name', 'PUT', { domain: 'home.example.fr' });

        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'server-settings.domain-name-changed',
                outcome: 'successful',
            }),
        );
    });
    it('rejects an Owner', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/server-settings/domain-name', 'PUT', {
            domain: 'home.example.fr',
        });

        expect(response.status).toBe(403);
    });
    it('rejects an unauthenticated request', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/server-settings/domain-name', 'PUT', {
            domain: 'home.example.fr',
        });

        expect(response.status).toBe(401);
    });
});

describe('GET /api/server-settings with a domain name', () => {
    it('gives the saved domain name', async () => {
        const client = await app.authenticatedClient(admin);

        await app.dependencies.internetAccess.domainName.save(
            DomainName.optional('home.example.fr'),
        );

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect(response.body.domainName).toBe('home.example.fr');
    });
});
