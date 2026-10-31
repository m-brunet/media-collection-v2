import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../tests/api/fixtures/user.fixture.js';

let app: TestApp;
const admin = new UserFixture({ username: 'administrator', role: 'admin' });
const member = new UserFixture({ username: 'member' });
const restricted = new UserFixture({
    username: 'restricted',
    role: 'admin',
    mustChangePassword: true,
});

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([admin, member, restricted]);
});
afterEach(async () => {
    await app?.teardown();
});
describe('GET /api/health', () => {
    it('does not renew an authenticated session', async () => {
        const client = await app.authenticatedClient(member);
        const previous = client.cookies.get('app_auth');

        app.advance(30 * 60_000);

        const response = await client.call('/health');

        expect(response.status).toBe(200);
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(client.cookies.get('app_auth')).toBe(previous);
    });
    it('is publicly ready without renewing cookies', async () => {
        const client = app.client();

        const response = await client.call('/health', 'GET');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ ready: true });
        expect(response.headers['set-cookie']).toBeUndefined();
    });
});
