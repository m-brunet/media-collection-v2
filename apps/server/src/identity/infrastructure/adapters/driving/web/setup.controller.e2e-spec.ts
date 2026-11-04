import type { Account, SetupStatus } from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { desktopWindow } from '../../../../../../../../tests/api/client.js';

let app: TestApp;

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
});
afterEach(async () => {
    await app?.teardown();
});

describe('GET /api/setup', () => {
    it('reports first launch and allows setup in the desktop window', async () => {
        const client = app.client();

        const response = await client.call<SetupStatus>('/setup', 'GET', undefined, {
            headers: desktopWindow,
        });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ required: true, allowed: true });
    });
    it('tells a browser that setup belongs to the desktop window', async () => {
        const client = app.client();

        const response = await client.call<SetupStatus>('/setup');

        expect(response.body).toEqual({ required: true, allowed: false });
    });
    it('reports a completed setup', async () => {
        await app.loadFixtures([new UserFixture({ role: 'admin' })]);
        const client = app.client();

        const response = await client.call<SetupStatus>('/setup');

        expect(response.body.required).toBe(false);
    });
});

describe('POST /api/setup', () => {
    it('creates the protected administrator and signs it in', async () => {
        const client = app.client();

        await client.prepare();
        const input = { username: 'Alex', password: 'chosen-password' };

        const response = await client.call<Account>('/setup', 'POST', input, {
            headers: desktopWindow,
        });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            username: 'alex',
            role: 'admin',
            mustChangePassword: false,
        });
    });
    it('leaves the new administrator signed in', async () => {
        const client = app.client();

        await client.prepare();
        await client.call(
            '/setup',
            'POST',
            { username: 'alex', password: 'chosen-password' },
            { headers: desktopWindow },
        );

        const response = await client.call<Account>('/auth/me');

        expect(response.status).toBe(200);
        expect(response.body.username).toBe('alex');
    });
    it('records the setup without the password', async () => {
        const client = app.client();

        await client.prepare();

        await client.call(
            '/setup',
            'POST',
            { username: 'alex', password: 'chosen-password' },
            { headers: desktopWindow },
        );

        expect(await app.dependencies.audit.entries()).toEqual([
            expect.objectContaining({
                category: 'setup.administrator-created',
                outcome: 'successful',
            }),
        ]);
        expect(await app.dependencies.audit.text()).not.toContain('chosen-password');
    });
    it('refuses a second setup', async () => {
        await app.loadFixtures([new UserFixture({ role: 'admin' })]);
        const client = app.client();

        await client.prepare();

        const response = await client.call(
            '/setup',
            'POST',
            { username: 'intruder', password: 'chosen-password' },
            { headers: desktopWindow },
        );

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('setup-completed');
        expect(await app.dependencies.users.list()).toHaveLength(1);
    });
    it('refuses setup from a browser, even on the same computer', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/setup', 'POST', {
            username: 'alex',
            password: 'chosen-password',
        });

        expect(response.status).toBe(403);
        expect(response.body.reason).toBe('setup-desktop-only');
        expect(await app.dependencies.users.list()).toEqual([]);
    });
    it('refuses a forged setup secret', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call(
            '/setup',
            'POST',
            { username: 'alex', password: 'chosen-password' },
            { headers: { 'X-Media-Collection-Setup': 'guessed-secret' } },
        );

        expect(response.status).toBe(403);
    });
    it('rejects a short password', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call(
            '/setup',
            'POST',
            { username: 'alex', password: 'short' },
            { headers: desktopWindow },
        );

        expect(response.status).toBe(400);
        expect(await app.dependencies.users.list()).toEqual([]);
    });
    it('rejects missing CSRF protection', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call(
            '/setup',
            'POST',
            { username: 'alex', password: 'chosen-password' },
            { csrf: false, headers: desktopWindow },
        );

        expect(response.status).toBe(403);
    });
});
