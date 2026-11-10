import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';

let app: TestApp;
const admin = new UserFixture({ username: 'administrator', role: 'admin' });
const owner = new UserFixture({ username: 'camille', role: 'owner' });
const guest = new UserFixture({ username: 'morgan', role: 'guest' });

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([admin, owner, guest]);
});
afterEach(async () => {
    await app?.teardown();
});

async function populatedLibrary() {
    const client = await app.authenticatedClient(admin);

    await app.dependencies.builders.loan();
    await client.call('/tags', 'POST', { name: 'Signed copies' });
    await client.call('/appearance', 'PUT', { colorScheme: 'rose-noir' });

    return client;
}

describe('POST /api/maintenance/data-reset', () => {
    it('erases the library, loans and receivers', async () => {
        const client = await populatedLibrary();

        const response = await client.call('/maintenance/data-reset', 'POST', {
            password: admin.password,
        });

        expect(response.status).toBe(204);
        expect(await app.dependencies.library.bookIds()).toEqual([]);
        expect(await app.dependencies.library.loans()).toEqual([]);
        expect(await app.dependencies.library.receivers()).toEqual([]);
    });
    it('keeps only the Admin account', async () => {
        const client = await populatedLibrary();

        await client.call('/maintenance/data-reset', 'POST', { password: admin.password });

        const accounts = await app.dependencies.users.list();

        expect(accounts.map((account) => account.actor.username)).toEqual(['administrator']);
    });
    it('keeps the Admin password', async () => {
        const client = await populatedLibrary();
        const before = (await app.dependencies.users.findById(admin.id))!.snapshot;

        await client.call('/maintenance/data-reset', 'POST', { password: admin.password });

        const after = (await app.dependencies.users.findById(admin.id))!.snapshot;

        expect(after.passwordHash).toBe(before.passwordHash);
        expect(after.mustChangePassword).toBe(false);
    });
    it('returns the colour scheme to Spring green', async () => {
        const client = await populatedLibrary();

        await client.call('/maintenance/data-reset', 'POST', { password: admin.password });

        expect((await app.dependencies.appearance.read()).name).toBe('spring-green');
    });
    it('leaves only its own audit record, so Activity starts empty', async () => {
        const client = await populatedLibrary();

        await client.call('/maintenance/data-reset', 'POST', { password: admin.password });

        expect(await app.dependencies.audit.entries()).toEqual([
            expect.objectContaining({
                category: 'maintenance.data-reset',
                outcome: 'successful',
                actorId: admin.id,
            }),
        ]);
    });
    it('signs the Admin out', async () => {
        const client = await populatedLibrary();

        const response = await client.call('/maintenance/data-reset', 'POST', {
            password: admin.password,
        });

        expect(response.headers['set-cookie']!.join(';')).toMatch(/app_auth=;/);
    });
    it('ends every Admin session', async () => {
        const client = await populatedLibrary();
        const before = (await app.dependencies.users.findById(admin.id))!.snapshot.tokenVersion;

        await client.call('/maintenance/data-reset', 'POST', { password: admin.password });

        const after = (await app.dependencies.users.findById(admin.id))!.snapshot.tokenVersion;

        expect(after).toBeGreaterThan(before);
    });
    it('refuses a wrong password and keeps the data', async () => {
        const client = await populatedLibrary();

        const response = await client.call('/maintenance/data-reset', 'POST', {
            password: 'wrong-password',
        });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('password-incorrect');
        expect(await app.dependencies.library.bookIds()).toHaveLength(1);
        expect(await app.dependencies.users.list()).toHaveLength(3);
    });
    it('records a refused reset as failed', async () => {
        const client = await populatedLibrary();

        await client.call('/maintenance/data-reset', 'POST', { password: 'wrong-password' });

        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'maintenance.data-reset',
                outcome: 'failed',
                failure: 'invalid_input:password-incorrect',
            }),
        );
    });
    it('refuses an Owner', async () => {
        await populatedLibrary();
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/maintenance/data-reset', 'POST', {
            password: owner.password,
        });

        expect(response.status).toBe(403);
        expect(await app.dependencies.library.bookIds()).toHaveLength(1);
    });
    it('refuses a Guest', async () => {
        await populatedLibrary();
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/maintenance/data-reset', 'POST', {
            password: guest.password,
        });

        expect(response.status).toBe(403);
        expect(await app.dependencies.library.bookIds()).toHaveLength(1);
    });
    it('refuses a signed-out visitor', async () => {
        await populatedLibrary();
        const client = app.client();

        await client.prepare();

        const response = await client.call('/maintenance/data-reset', 'POST', {
            password: admin.password,
        });

        expect(response.status).toBe(401);
        expect(await app.dependencies.library.bookIds()).toHaveLength(1);
    });
    it('refuses a request without the password', async () => {
        const client = await populatedLibrary();

        const response = await client.call('/maintenance/data-reset', 'POST', {});

        expect(response.status).toBe(400);
        expect(await app.dependencies.library.bookIds()).toHaveLength(1);
    });
});
