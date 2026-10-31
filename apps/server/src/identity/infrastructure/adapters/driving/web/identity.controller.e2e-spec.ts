import type { Account } from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';

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
describe('GET /api/auth/csrf', () => {
    it('returns a signed token cookie with no-store caching', async () => {
        const client = app.client();

        const response = await client.call('/auth/csrf', 'GET');

        expect(response.status).toBe(200);
        expect(response.body.token).toMatch(/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]+$/);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(client.cookies.get('app_csrf')).toBe(response.body.token);
        expect(response.headers['set-cookie']!.join(';')).toContain('SameSite=Lax');
    });
    it('reuses an existing valid token', async () => {
        const client = app.client();

        await client.prepare();
        const token = client.cookies.get('app_csrf');

        const response = await client.call('/auth/csrf', 'GET');

        expect(response.body.token).toBe(token);
        expect(response.headers['set-cookie']).toBeUndefined();
    });
});
describe('POST /api/auth/login', () => {
    it('authenticates a user with safe account data and HTTP-only cookies', async () => {
        const client = app.client();

        await client.prepare();
        const input = { username: member.username, password: member.password };

        const response = await client.call('/auth/login', 'POST', input);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: member.id,
            username: member.username,
            role: 'user',
            mustChangePassword: false,
        });
        expect(response.body).not.toHaveProperty('passwordHash');
        expect(response.headers['set-cookie']!.join(';')).toContain('HttpOnly');
        expect(response.headers['set-cookie']!.join(';')).not.toContain('Secure');
    });
    it('returns temporary-password state', async () => {
        const client = app.client();

        await client.prepare();
        const input = { username: restricted.username, password: restricted.password };

        const response = await client.call('/auth/login', 'POST', input);

        expect(response.status).toBe(200);
        expect(response.body.mustChangePassword).toBe(true);
    });
    it('rejects login for a missing user', async () => {
        const input = { username: 'missing', password: 'fixture-password' };
        const client = app.client();

        await client.prepare();
        const status = typeof input.username === 'number' ? 400 : 401;

        const response = await client.call('/auth/login', 'POST', input);

        expect(response.status).toBe(status);
    });
    it('rejects login with an incorrect password', async () => {
        const input = { username: 'member', password: 'wrong' };
        const client = app.client();

        await client.prepare();
        const status = typeof input.username === 'number' ? 400 : 401;

        const response = await client.call('/auth/login', 'POST', input);

        expect(response.status).toBe(status);
    });
    it('rejects a nonstring login username', async () => {
        const input = { username: 3, password: 'x' };
        const client = app.client();

        await client.prepare();
        const status = typeof input.username === 'number' ? 400 : 401;

        const response = await client.call('/auth/login', 'POST', input);

        expect(response.status).toBe(status);
    });
    it('rejects missing CSRF', async () => {
        const client = app.client();

        await client.prepare();
        const input = { username: member.username, password: member.password };

        const response = await client.call('/auth/login', 'POST', input, { csrf: false });

        expect(response.status).toBe(403);
    });
    it('rejects a foreign Origin', async () => {
        const client = app.client();

        await client.prepare();
        const input = { username: member.username, password: member.password };

        const response = await client.call('/auth/login', 'POST', input, {
            origin: 'http://attacker.invalid',
        });

        expect(response.status).toBe(403);
    });
    it('throttles attempts after the allowed limit', async () => {
        const client = app.client();

        await client.prepare();
        const input = { username: 'missing', password: 'wrong' };

        for (let attempt = 0; attempt < 30; attempt++) {
            await client.call('/auth/login', 'POST', input);
        }

        const response = await client.call('/auth/login', 'POST', input);

        expect(response.status).toBe(403);
        expect(response.body.message).toContain('Too many');
    });
});
describe('GET /api/auth/me', () => {
    it('rejects the session after logout', async () => {
        const client = await app.authenticatedClient(member);

        await client.call('/auth/logout', 'POST');

        const response = await client.call('/auth/me');

        expect(response.status).toBe(401);
    });

    it('rejects the previous session after a real password change', async () => {
        const client = await app.authenticatedClient(member);
        const stale = app.client();

        stale.cookies.set('app_auth', client.cookies.get('app_auth')!);
        await client.call('/account/password', 'PATCH', {
            currentPassword: member.password,
            password: 'new-password',
        });

        const response = await stale.call('/auth/me');

        expect(response.status).toBe(401);
    });

    it('accepts a passive session 59 minutes after renewal', async () => {
        const minutes = 59;
        const client = await app.authenticatedClient(member);

        app.advance(30 * 60_000);
        await client.call('/auth/me');
        app.advance(minutes * 60_000);

        const response = await client.call('/auth/me', 'GET', undefined, { passive: true });

        expect(response.status).toBe(minutes < 60 ? 200 : 401);
    });
    it('rejects a passive session 61 minutes after renewal', async () => {
        const minutes = 61;
        const client = await app.authenticatedClient(member);

        app.advance(30 * 60_000);
        await client.call('/auth/me');
        app.advance(minutes * 60_000);

        const response = await client.call('/auth/me', 'GET', undefined, { passive: true });

        expect(response.status).toBe(minutes < 60 ? 200 : 401);
    });
    it('returns the authenticated account', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/auth/me', 'GET');

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(member.id);
        expect(response.body).not.toHaveProperty('passwordHash');
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/auth/me', 'GET');

        expect(response.status).toBe(401);
    });
    it('allows temporary-password credentials', async () => {
        const client = await app.authenticatedClient(restricted);

        const response = await client.call('/auth/me', 'GET');

        expect(response.status).toBe(200);
        expect(response.body.mustChangePassword).toBe(true);
    });
    it('does not renew a passive session', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/auth/me', 'GET', undefined, { passive: true });

        expect(response.status).toBe(200);
        expect(response.headers['set-cookie']).toBeUndefined();
    });
    it('renews a session on an active request', async () => {
        const client = await app.authenticatedClient(member);

        app.advance(30 * 60_000);
        const previous = client.cookies.get('app_auth');

        const response = await client.call('/auth/me', 'GET');

        expect(response.status).toBe(200);
        expect(client.cookies.get('app_auth')).not.toBe(previous);
    });
    it('rejects an expired session', async () => {
        const client = await app.authenticatedClient(member);

        app.advance(60 * 60_000);

        const response = await client.call('/auth/me', 'GET');

        expect(response.status).toBe(401);
    });
    it('rejects an invalidated session', async () => {
        const client = await app.authenticatedClient(member);
        const account = (await app.dependencies.users.findById(member.id))!;

        account.replacePassword('new-hash');
        await app.dependencies.users.save(account, 0);

        const response = await client.call('/auth/me', 'GET');

        expect(response.status).toBe(401);
    });
});
describe('POST /api/auth/logout', () => {
    it('clears both session cookies with an empty 204 response', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/auth/logout', 'POST', {});

        expect(response.status).toBe(204);
        expect(response.text).toBe('');
        expect(client.cookies.get('app_auth')).toBe('');
        expect(client.cookies.get('app_csrf')).toBe('');
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/auth/logout', 'POST', {});

        expect(response.status).toBe(401);
    });
    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/auth/logout', 'POST', {}, { csrf: false });

        expect(response.status).toBe(403);
    });
});
describe('PATCH /api/account/username', () => {
    it('allows renaming during mandatory password setup', async () => {
        const client = await app.authenticatedClient(restricted);
        const input = { username: 'renamed', currentPassword: restricted.password };

        const response = await client.call('/account/username', 'PATCH', input);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ username: 'renamed', mustChangePassword: true });
    });
    it('normalizes and persists the new username', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/account/username', 'PATCH', {
            username: ' Renamed ',
            currentPassword: admin.password,
        });

        expect(response.status).toBe(200);
        expect(response.body.username).toBe('renamed');
        expect((await app.dependencies.users.findById(admin.id))!.actor.username).toBe('renamed');
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/account/username', 'PATCH', {
            username: 'renamed',
            currentPassword: admin.password,
        });

        expect(response.status).toBe(401);
    });
    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call(
            '/account/username',
            'PATCH',
            { username: 'renamed', currentPassword: admin.password },
            { csrf: false },
        );

        expect(response.status).toBe(403);
    });
    it('rejects rename with an incorrect current password', async () => {
        const input = { username: 'renamed', currentPassword: 'wrong' };
        const client = await app.authenticatedClient(admin);
        const status = input.username === 'member' ? 409 : 400;

        const response = await client.call('/account/username', 'PATCH', input);

        expect(response.status).toBe(status);
        expect((await app.dependencies.users.findById(admin.id))!.actor.username).toBe(
            admin.username,
        );
    });
    it('rejects rename to an invalid username', async () => {
        const input = { username: '!', currentPassword: 'fixture-password' };
        const client = await app.authenticatedClient(admin);
        const status = input.username === 'member' ? 409 : 400;

        const response = await client.call('/account/username', 'PATCH', input);

        expect(response.status).toBe(status);
        expect((await app.dependencies.users.findById(admin.id))!.actor.username).toBe(
            admin.username,
        );
    });
    it('rejects rename to a duplicate username', async () => {
        const input = { username: 'member', currentPassword: 'fixture-password' };
        const client = await app.authenticatedClient(admin);
        const status = input.username === 'member' ? 409 : 400;

        const response = await client.call('/account/username', 'PATCH', input);

        expect(response.status).toBe(status);
        expect((await app.dependencies.users.findById(admin.id))!.actor.username).toBe(
            admin.username,
        );
    });
});
describe('PATCH /api/account/password', () => {
    it('completes setup, stores a hash, and replaces the cookie', async () => {
        const client = await app.authenticatedClient(restricted);
        const previous = client.cookies.get('app_auth');
        const input = { currentPassword: restricted.password, password: 'replacement-password' };

        const response = await client.call('/account/password', 'PATCH', input);

        expect(response.status).toBe(200);
        expect(response.body.mustChangePassword).toBe(false);
        expect(client.cookies.get('app_auth')).not.toBe(previous);
        expect((await app.dependencies.users.findById(restricted.id))!.snapshot.tokenVersion).toBe(
            1,
        );
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/account/password', 'PATCH', {
            currentPassword: admin.password,
            password: 'replacement-password',
        });

        expect(response.status).toBe(401);
    });
    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call(
            '/account/password',
            'PATCH',
            { currentPassword: admin.password, password: 'replacement-password' },
            { csrf: false },
        );

        expect(response.status).toBe(403);
    });
    it('rejects replacement with an incorrect current password', async () => {
        const input = { currentPassword: 'wrong', password: 'replacement-password' };
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/account/password', 'PATCH', input);

        expect(response.status).toBe(400);
        expect((await app.dependencies.users.findById(admin.id))!.snapshot.tokenVersion).toBe(0);
    });
    it('rejects a short replacement password', async () => {
        const input = { currentPassword: 'fixture-password', password: 'short' };
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/account/password', 'PATCH', input);

        expect(response.status).toBe(400);
        expect((await app.dependencies.users.findById(admin.id))!.snapshot.tokenVersion).toBe(0);
    });
    it('rejects an unchanged replacement password', async () => {
        const input = { currentPassword: 'fixture-password', password: 'fixture-password' };
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/account/password', 'PATCH', input);

        expect(response.status).toBe(400);
        expect((await app.dependencies.users.findById(admin.id))!.snapshot.tokenVersion).toBe(0);
    });
});
describe('GET /api/users', () => {
    it('lists safe accounts for administrators', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/users', 'GET');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(3);
        expect(response.text).not.toContain('passwordHash');
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/users', 'GET');

        expect(response.status).toBe(401);
    });
    it('rejects incomplete password setup', async () => {
        const client = await app.authenticatedClient(restricted);

        const response = await client.call('/users', 'GET');

        expect(response.status).toBe(403);
    });
    it('rejects non-administrators', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/users', 'GET');

        expect(response.status).toBe(403);
    });
});
describe('POST /api/users', () => {
    it('creates a restricted account without exposing secrets', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<Account>('/users', 'POST', {
            username: 'new-member',
            password: 'temporary-password',
            role: 'user',
        });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            username: 'new-member',
            role: 'user',
            mustChangePassword: true,
        });
        expect(response.body).not.toHaveProperty('passwordHash');
        expect((await app.dependencies.users.findById(response.body.id))!.actor.username).toBe(
            'new-member',
        );
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call<Account>('/users', 'POST', {
            username: 'new-member',
            password: 'temporary-password',
            role: 'user',
        });

        expect(response.status).toBe(401);
    });
    it('rejects incomplete password setup', async () => {
        const client = await app.authenticatedClient(restricted);

        const response = await client.call<Account>('/users', 'POST', {
            username: 'new-member',
            password: 'temporary-password',
            role: 'user',
        });

        expect(response.status).toBe(403);
    });
    it('rejects non-administrators', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call<Account>('/users', 'POST', {
            username: 'new-member',
            password: 'temporary-password',
            role: 'user',
        });

        expect(response.status).toBe(403);
    });
    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<Account>(
            '/users',
            'POST',
            { username: 'new-member', password: 'temporary-password', role: 'user' },
            { csrf: false },
        );

        expect(response.status).toBe(403);
    });
    it('rejects creation with a duplicate username', async () => {
        const input = { username: 'member', password: 'temporary-password', role: 'user' };
        const client = await app.authenticatedClient(admin);
        const status = input.username === 'member' ? 409 : 400;

        const response = await client.call('/users', 'POST', input);

        expect(response.status).toBe(status);
        expect(await app.dependencies.users.list()).toHaveLength(3);
    });
    it('rejects creation with an invalid username', async () => {
        const input = { username: 'invalid!', password: 'temporary-password', role: 'user' };
        const client = await app.authenticatedClient(admin);
        const status = input.username === 'member' ? 409 : 400;

        const response = await client.call('/users', 'POST', input);

        expect(response.status).toBe(status);
        expect(await app.dependencies.users.list()).toHaveLength(3);
    });
    it('rejects creation with a short password', async () => {
        const input = { username: 'valid', password: 'short', role: 'user' };
        const client = await app.authenticatedClient(admin);
        const status = input.username === 'member' ? 409 : 400;

        const response = await client.call('/users', 'POST', input);

        expect(response.status).toBe(status);
        expect(await app.dependencies.users.list()).toHaveLength(3);
    });
    it('rejects creation with an invalid role', async () => {
        const input = { username: 'valid', password: 'temporary-password', role: 'root' };
        const client = await app.authenticatedClient(admin);
        const status = input.username === 'member' ? 409 : 400;

        const response = await client.call('/users', 'POST', input);

        expect(response.status).toBe(status);
        expect(await app.dependencies.users.list()).toHaveLength(3);
    });
});
