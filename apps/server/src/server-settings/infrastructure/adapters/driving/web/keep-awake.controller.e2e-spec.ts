import type { ServerStatus } from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';

let app: TestApp;
const admin = new UserFixture({ username: 'administrator', role: 'admin' });
const member = new UserFixture({ username: 'member' });

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([admin, member]);
});
afterEach(async () => {
    await app?.teardown();
});
describe('PUT /api/server-settings/keep-awake', () => {
    it('keeps the computer awake at once', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/keep-awake', 'PUT', {
            enabled: true,
        });

        expect([
            response.status,
            response.body,
            app.dependencies.internetAccess.keepAwake.applied,
        ]).toEqual([200, { enabled: true }, [true]]);
    });
    it('records the change in the technical audit log', async () => {
        const client = await app.authenticatedClient(admin);

        await client.call('/server-settings/keep-awake', 'PUT', { enabled: true });

        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'server-settings.keep-awake-changed',
                outcome: 'successful',
                after: { enabled: true },
            }),
        );
    });
    it('rejects a value that is not true or false', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/keep-awake', 'PUT', {
            enabled: 'yes',
        });

        expect(response.status).toBe(400);
    });
    it('rejects an Owner', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/server-settings/keep-awake', 'PUT', {
            enabled: true,
        });

        expect(response.status).toBe(403);
    });
});
describe('GET /api/server-settings', () => {
    it('reports keep awake off and internet access off by default', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect([response.body.keepAwake, response.body.internetAccess.phase]).toEqual([
            false,
            'off',
        ]);
    });
});
