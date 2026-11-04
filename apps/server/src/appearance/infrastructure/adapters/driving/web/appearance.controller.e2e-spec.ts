import type { Appearance } from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';

let app: TestApp;
const admin = new UserFixture({ username: 'administrator', role: 'admin' });
const owner = new UserFixture({ username: 'camille', role: 'owner' });

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([admin, owner]);
});
afterEach(async () => {
    await app?.teardown();
});

describe('GET /api/appearance', () => {
    it('gives the default Spring green scheme to a signed-out visitor', async () => {
        const client = app.client();

        const response = await client.call<Appearance>('/appearance');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ colorScheme: 'spring-green' });
    });
    it('gives the saved scheme', async () => {
        const client = await app.authenticatedClient(admin);

        await client.call('/appearance', 'PUT', { colorScheme: 'forest' });

        const response = await app.client().call<Appearance>('/appearance');

        expect(response.body.colorScheme).toBe('forest');
    });
});

describe('PUT /api/appearance', () => {
    it('lets the administrator change the scheme for everyone', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<Appearance>('/appearance', 'PUT', {
            colorScheme: 'mint',
        });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ colorScheme: 'mint' });
        expect((await app.dependencies.appearance.read()).name).toBe('mint');
    });
    it('records the change in the audit log', async () => {
        const client = await app.authenticatedClient(admin);

        await client.call('/appearance', 'PUT', { colorScheme: 'emerald' });

        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'appearance.color-scheme-changed',
                outcome: 'successful',
                actorId: admin.id,
            }),
        );
    });
    it('rejects an unknown scheme', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/appearance', 'PUT', { colorScheme: 'purple' });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('color-scheme-unknown');
    });
    it('rejects an Owner', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/appearance', 'PUT', { colorScheme: 'mint' });

        expect(response.status).toBe(403);
        expect((await app.dependencies.appearance.read()).name).toBe('spring-green');
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/appearance', 'PUT', { colorScheme: 'mint' });

        expect(response.status).toBe(401);
    });
    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call(
            '/appearance',
            'PUT',
            { colorScheme: 'mint' },
            { csrf: false },
        );

        expect(response.status).toBe(403);
    });
});
