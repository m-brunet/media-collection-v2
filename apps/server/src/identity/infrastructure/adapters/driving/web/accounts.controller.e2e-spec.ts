import type { AccountSummary } from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';

let app: TestApp;
const admin = new UserFixture({ username: 'administrator', role: 'admin' });
const owner = new UserFixture({ username: 'camille', role: 'owner' });
const guest = new UserFixture({ username: 'morgan', role: 'guest' });
const former = new UserFixture({ username: 'robin', role: 'owner', active: false });

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([admin, owner, guest, former]);
});
afterEach(async () => {
    await app?.teardown();
});

describe('GET /api/users', () => {
    it('lists every account with role and status for the administrator', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<AccountSummary[]>('/users');

        expect(response.status).toBe(200);
        expect(response.body).toContainEqual({
            id: former.id,
            username: 'robin',
            role: 'owner',
            mustChangePassword: false,
            active: false,
        });
        expect(response.body).toHaveLength(4);
        expect(response.text).not.toContain('passwordHash');
    });
    it('rejects an Owner', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/users');

        expect(response.status).toBe(403);
    });
    it('rejects a Guest', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/users');

        expect(response.status).toBe(403);
    });
    it('rejects an administrator who has not replaced a temporary password', async () => {
        await app.requirePasswordReplacement(admin);
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/users');

        expect(response.status).toBe(403);
        expect(response.body.reason).toBe('temporary-password');
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/users');

        expect(response.status).toBe(401);
    });
});

describe('POST /api/users', () => {
    it('creates an Owner with a temporary password', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { username: 'Sam', password: 'temporary-password', role: 'owner' };

        const response = await client.call<AccountSummary>('/users', 'POST', input);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            username: 'Sam',
            role: 'owner',
            mustChangePassword: true,
            active: true,
        });
        expect(response.text).not.toContain('temporary-password');
    });
    it('creates a Guest', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { username: 'friend', password: 'temporary-password', role: 'guest' };

        const response = await client.call<AccountSummary>('/users', 'POST', input);

        expect(response.status).toBe(201);
        expect(response.body.role).toBe('guest');
    });
    it('records the creation in the audit log without the password', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { username: 'sam', password: 'temporary-password', role: 'owner' };

        const response = await client.call<AccountSummary>('/users', 'POST', input);

        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'account.created',
                outcome: 'successful',
                actorId: admin.id,
                subjectId: response.body.id,
            }),
        );
        expect(await app.dependencies.audit.text()).not.toContain('temporary-password');
    });
    it('refuses to create a second administrator', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { username: 'second', password: 'temporary-password', role: 'admin' };

        const response = await client.call('/users', 'POST', input);

        expect(response.status).toBe(400);
        expect(await app.dependencies.users.list()).toHaveLength(4);
    });
    it('requires a role choice', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { username: 'sam', password: 'temporary-password' };

        const response = await client.call('/users', 'POST', input);

        expect(response.status).toBe(400);
    });
    it('refuses a username differing from an existing one only by letter case', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { username: 'Camille', password: 'temporary-password', role: 'guest' };

        const response = await client.call('/users', 'POST', input);

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('username-taken');
    });
    it('refuses the reserved username of a deactivated account', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { username: 'robin', password: 'temporary-password', role: 'guest' };

        const response = await client.call('/users', 'POST', input);

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('username-taken');
    });
    it('rejects an Owner creating accounts', async () => {
        const client = await app.authenticatedClient(owner);
        const input = { username: 'sam', password: 'temporary-password', role: 'guest' };

        const response = await client.call('/users', 'POST', input);

        expect(response.status).toBe(403);
    });
    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { username: 'sam', password: 'temporary-password', role: 'guest' };

        const response = await client.call('/users', 'POST', input, { csrf: false });

        expect(response.status).toBe(403);
    });
});

describe('POST /api/users/:id/password-reset', () => {
    it('gives the account a temporary password', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { password: 'new-temporary' };

        const response = await client.call<AccountSummary>(
            '/users/' + owner.id + '/password-reset',
            'POST',
            input,
        );

        expect(response.status).toBe(200);
        expect(response.body.mustChangePassword).toBe(true);
    });
    it('lets the account sign in with the temporary password', async () => {
        const client = await app.authenticatedClient(admin);

        await client.call('/users/' + owner.id + '/password-reset', 'POST', {
            password: 'new-temporary',
        });
        const visitor = app.client();

        const response = await visitor.login('camille', 'new-temporary');

        expect(response.status).toBe(200);
        expect(response.body.mustChangePassword).toBe(true);
    });
    it('ends the existing sessions of the account', async () => {
        const session = await app.authenticatedClient(owner);
        const client = await app.authenticatedClient(admin);

        await client.call('/users/' + owner.id + '/password-reset', 'POST', {
            password: 'new-temporary',
        });

        const response = await session.call('/auth/me');

        expect(response.status).toBe(401);
    });
    it('refuses to reset the protected administrator', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/users/' + admin.id + '/password-reset', 'POST', {
            password: 'new-temporary',
        });

        expect(response.status).toBe(403);
        expect(response.body.reason).toBe('protected-administrator');
    });
    it('reports an unknown account', async () => {
        const client = await app.authenticatedClient(admin);
        const missing = '00000000-0000-4000-8000-000000000000';

        const response = await client.call('/users/' + missing + '/password-reset', 'POST', {
            password: 'new-temporary',
        });

        expect(response.status).toBe(404);
    });
    it('rejects a short temporary password', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/users/' + owner.id + '/password-reset', 'POST', {
            password: 'short',
        });

        expect(response.status).toBe(400);
    });
    it('rejects an Owner', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/users/' + guest.id + '/password-reset', 'POST', {
            password: 'new-temporary',
        });

        expect(response.status).toBe(403);
    });
});

describe('POST /api/users/:id/deactivation', () => {
    it('deactivates an account', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<AccountSummary>(
            '/users/' + guest.id + '/deactivation',
            'POST',
        );

        expect(response.status).toBe(200);
        expect(response.body.active).toBe(false);
    });
    it('signs the deactivated account out immediately', async () => {
        const session = await app.authenticatedClient(guest);
        const client = await app.authenticatedClient(admin);

        await client.call('/users/' + guest.id + '/deactivation', 'POST');

        const response = await session.call('/auth/me');

        expect(response.status).toBe(401);
    });
    it('prevents the deactivated account from signing in', async () => {
        const client = await app.authenticatedClient(admin);

        await client.call('/users/' + guest.id + '/deactivation', 'POST');
        const visitor = app.client();

        const response = await visitor.login(guest.username, guest.password);

        expect(response.status).toBe(401);
    });
    it('refuses to deactivate the protected administrator', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/users/' + admin.id + '/deactivation', 'POST');

        expect(response.status).toBe(403);
        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'account.deactivated',
                outcome: 'failed',
                failure: 'forbidden:protected-administrator',
            }),
        );
    });
    it('rejects an invalid account identifier', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/users/not-an-id/deactivation', 'POST');

        expect(response.status).toBe(400);
    });
    it('rejects a Guest', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/users/' + owner.id + '/deactivation', 'POST');

        expect(response.status).toBe(403);
    });
});

describe('POST /api/users/:id/reactivation', () => {
    it('reactivates an account with its original role', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<AccountSummary>(
            '/users/' + former.id + '/reactivation',
            'POST',
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ role: 'owner', active: true });
    });
    it('lets the reactivated account sign in again', async () => {
        const client = await app.authenticatedClient(admin);

        await client.call('/users/' + former.id + '/reactivation', 'POST');
        const visitor = app.client();

        const response = await visitor.login('robin', former.password);

        expect(response.status).toBe(200);
    });
    it('reports an account that is already active', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/users/' + owner.id + '/reactivation', 'POST');

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('already-active');
    });
    it('rejects an Owner', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/users/' + former.id + '/reactivation', 'POST');

        expect(response.status).toBe(403);
    });
});
