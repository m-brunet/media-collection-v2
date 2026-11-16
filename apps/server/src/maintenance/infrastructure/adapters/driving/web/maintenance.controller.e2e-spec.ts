import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { BookInputFixture } from '../../../../../../../../tests/api/fixtures/book-input.fixture.js';
import type {
    ActivityPageDto,
    BookDto,
    KeptCoversDeletedDto,
    KeptCoversDto,
    KeptCoverSummaryDto,
    VolumeCoverDto,
} from '../../../../../../../../packages/contracts/src/http.js';

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

describe('kept covers and the data reset', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

    async function libraryWithCover() {
        const client = await app.authenticatedClient(admin);
        const book = (
            await client.call<BookDto>(
                '/books',
                'POST',
                BookInputFixture.of({ isbn: '9782253164692' }),
            )
        ).body;

        await client.call('/books/' + book.id + '/cover', 'PUT', undefined, {
            raw: { bytes: png, contentType: 'image/png' },
        });

        return client;
    }

    describe('GET /api/maintenance/kept-covers', () => {
        it('tells the Admin how many covers a reset would keep', async () => {
            const client = await libraryWithCover();

            const response = await client.call<KeptCoversDto>('/maintenance/kept-covers');

            expect([response.status, response.body]).toEqual([200, { count: 1 }]);
        });
        it('counts nothing in a library without covers', async () => {
            const client = await app.authenticatedClient(admin);

            const response = await client.call<KeptCoversDto>('/maintenance/kept-covers');

            expect(response.body).toEqual({ count: 0 });
        });
        it('refuses an Owner', async () => {
            const client = await app.authenticatedClient(owner);

            const response = await client.call('/maintenance/kept-covers');

            expect(response.status).toBe(403);
        });
        it('refuses a Guest', async () => {
            const client = await app.authenticatedClient(guest);

            const response = await client.call('/maintenance/kept-covers');

            expect(response.status).toBe(403);
        });
        it('requires a signed-in account', async () => {
            const client = app.client();

            const response = await client.call('/maintenance/kept-covers');

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/maintenance/data-reset', () => {
        it('keeps the covers of the erased books by default', async () => {
            const client = await libraryWithCover();

            const response = await client.call('/maintenance/data-reset', 'POST', {
                password: admin.password,
            });

            expect(response.status).toBe(204);
            expect(await app.dependencies.books.covers.list()).toHaveLength(1);
            expect(
                await app.dependencies.books.keptCoverStore.find('9782253164692'),
            ).not.toBeNull();
        });
        it('deletes the kept covers and their pictures when asked', async () => {
            const client = await libraryWithCover();

            const response = await client.call('/maintenance/data-reset', 'POST', {
                password: admin.password,
                deleteKeptCovers: true,
            });

            expect(response.status).toBe(204);
            expect(await app.dependencies.books.covers.list()).toEqual([]);
            expect(await app.dependencies.books.keptCoverStore.find('9782253164692')).toBeNull();
        });
        it('rejects a choice about kept covers that is not yes or no', async () => {
            const client = await libraryWithCover();

            const response = await client.call('/maintenance/data-reset', 'POST', {
                password: admin.password,
                deleteKeptCovers: 'yes',
            });

            expect(response.status).toBe(400);
        });
    });
});

describe('kept covers kept after a deletion', () => {
    const isbn = '9782253164692';
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

    async function keptCover() {
        const client = await app.authenticatedClient(admin);
        const book = (await client.call<BookDto>('/books', 'POST', BookInputFixture.of({ isbn })))
            .body;

        await client.call('/books/' + book.id + '/cover', 'PUT', undefined, {
            raw: { bytes: png, contentType: 'image/png' },
        });
        await client.call('/books/' + book.id, 'DELETE');

        return client;
    }

    describe('GET /api/maintenance/kept-covers/summary', () => {
        it('tells the Admin how many covers are kept, their size and the oldest date', async () => {
            const client = await keptCover();

            const response = await client.call<KeptCoverSummaryDto>(
                '/maintenance/kept-covers/summary',
            );

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                count: 1,
                bytes: expect.any(Number),
                oldestKeptAt: expect.any(String),
            });
            expect(response.body.bytes).toBeGreaterThan(0);
        });
        it('leaves the covers on books out', async () => {
            const client = await app.authenticatedClient(admin);
            const book = (
                await client.call<BookDto>('/books', 'POST', BookInputFixture.of({ isbn }))
            ).body;

            await client.call('/books/' + book.id + '/cover', 'PUT', undefined, {
                raw: { bytes: png, contentType: 'image/png' },
            });

            const response = await client.call<KeptCoverSummaryDto>(
                '/maintenance/kept-covers/summary',
            );

            expect(response.body).toEqual({ count: 0, bytes: 0, oldestKeptAt: null });
        });
        it('refuses an Owner', async () => {
            const client = await app.authenticatedClient(owner);

            const response = await client.call('/maintenance/kept-covers/summary');

            expect(response.status).toBe(403);
        });
        it('refuses a Guest', async () => {
            const client = await app.authenticatedClient(guest);

            const response = await client.call('/maintenance/kept-covers/summary');

            expect(response.status).toBe(403);
        });
        it('requires a signed-in account', async () => {
            const client = app.client();

            const response = await client.call('/maintenance/kept-covers/summary');

            expect(response.status).toBe(401);
        });
    });

    describe('DELETE /api/maintenance/kept-covers', () => {
        it('deletes every kept cover and its picture', async () => {
            const client = await keptCover();

            const response = await client.call<KeptCoversDeletedDto>(
                '/maintenance/kept-covers',
                'DELETE',
            );

            expect([response.status, response.body]).toEqual([200, { deleted: 1 }]);
            expect(await app.dependencies.books.covers.list()).toEqual([]);
            expect(await app.dependencies.books.keptCoverStore.find(isbn)).toBeNull();
        });
        it('no longer offers the cover when the ISBN is looked up', async () => {
            const client = await keptCover();

            await client.call('/maintenance/kept-covers', 'DELETE');

            const lookup = await client.call<VolumeCoverDto>(
                '/books/lookups/volume-cover',
                'POST',
                { isbn },
            );

            expect(lookup.body).toEqual({ kind: 'none' });
        });
        it('leaves the covers on books in place', async () => {
            const client = await keptCover();
            const book = (
                await client.call<BookDto>(
                    '/books',
                    'POST',
                    BookInputFixture.of({ isbn: '9781635575637' }),
                )
            ).body;

            await client.call('/books/' + book.id + '/cover', 'PUT', undefined, {
                raw: { bytes: png, contentType: 'image/png' },
            });

            await client.call('/maintenance/kept-covers', 'DELETE');

            expect(await app.dependencies.books.covers.list()).toHaveLength(1);
        });
        it('shows the deletion in Activity, with the number of covers', async () => {
            const client = await keptCover();

            await client.call('/maintenance/kept-covers', 'DELETE');

            const activity = await client.call<ActivityPageDto>('/activity');

            expect(activity.body.entries.map((entry) => entry.event)).toContainEqual({
                kind: 'kept-covers-deleted',
                count: 1,
            });
        });
        it('refuses an Owner and deletes nothing', async () => {
            await keptCover();
            const client = await app.authenticatedClient(owner);

            const response = await client.call('/maintenance/kept-covers', 'DELETE');

            expect(response.status).toBe(403);
            expect(await app.dependencies.books.keptCoverStore.find(isbn)).not.toBeNull();
        });
        it('refuses a Guest', async () => {
            const client = await app.authenticatedClient(guest);

            const response = await client.call('/maintenance/kept-covers', 'DELETE');

            expect(response.status).toBe(403);
        });
        it('requires a signed-in account', async () => {
            const client = app.client();

            await client.prepare();

            const response = await client.call('/maintenance/kept-covers', 'DELETE');

            expect(response.status).toBe(401);
        });
    });
});
