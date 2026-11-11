import type {
    BookDto,
    TagDto,
    CollectionDetailsDto,
    CollectionListPageDto,
    CollectionNameDto,
    CollectionShoppingDto,
    ShoppingCollectionDto,
    MembershipDto,
    NewBookDto,
} from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { BookInputFixture } from '../../../../../../../../tests/api/fixtures/book-input.fixture.js';

let app: TestApp;
let counter = 0;
const owner = new UserFixture({ username: 'camille', role: 'owner' });
const guest = new UserFixture({ username: 'morgan', role: 'guest' });

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([owner, guest]);
});
afterEach(async () => {
    await app?.teardown();
});

function membership(name: string, volumeFrom: number, volumeTo = volumeFrom): MembershipDto {
    return { collection: { name }, volumeFrom, volumeTo };
}

async function book(collection: MembershipDto | null, overrides: Partial<NewBookDto> = {}) {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookDto>(
        '/books',
        'POST',
        BookInputFixture.of({
            title: 'Edition ' + ++counter,
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            collection,
            ...overrides,
        }),
    );

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

async function withCover(saved: BookDto) {
    const client = await app.authenticatedClient(owner);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const response = await client.call<BookDto>('/books/' + saved.id + '/cover', 'PUT', undefined, {
        raw: { bytes: png, contentType: 'image/png' },
    });

    if (response.status !== 200) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

describe('GET /api/collections', () => {
    it('lists collections by name with whole-collection counts', async () => {
        await book(membership('Dune', 1));
        await book(membership('Batman', 1, 3));
        await book(membership('Batman', 12), { ownership: 'not-owned' });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<CollectionListPageDto>('/collections');

        expect(response.status).toBe(200);
        expect(response.body.total).toBe(2);
        expect(response.body.items.map((item) => item.name)).toEqual(['Batman', 'Dune']);
        expect(response.body.items[0]).toMatchObject({
            bookCount: 2,
            expectedCount: 12,
            ownedCount: 3,
            missingCount: 9,
            lastOwned: 3,
            finished: false,
        });
    });
    it('previews the covers of owned books before the others', async () => {
        const planned = await withCover(
            await book(membership('Batman', 1), { ownership: 'not-owned' }),
        );

        await book(membership('Batman', 2));
        const owned = await withCover(await book(membership('Batman', 3)));
        const client = await app.authenticatedClient(guest);

        const response = await client.call<CollectionListPageDto>('/collections');

        expect(response.status).toBe(200);
        expect(response.body.items[0]?.previews).toEqual([
            { id: owned.id, title: owned.title, updatedAt: owned.updatedAt },
            { id: planned.id, title: planned.title, updatedAt: planned.updatedAt },
        ]);
    });
    it('sorts collections from Z to A', async () => {
        await book(membership('Dune', 1));
        await book(membership('Batman', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionListPageDto>('/collections?direction=desc');

        expect(response.body.items.map((item) => item.name)).toEqual(['Dune', 'Batman']);
    });
    it('finds a collection through one of its books, keeping whole counts', async () => {
        await book(membership('Dune', 1), { title: 'Dune Messiah' });
        await book(membership('Dune', 2), { title: 'Children of Dune', ownership: 'not-owned' });
        await book(membership('Batman', 1), { title: 'Year One' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionListPageDto>('/collections?search=messiah');

        expect(response.body.items).toEqual([
            expect.objectContaining({ name: 'Dune', ownedCount: 1, expectedCount: 2 }),
        ]);
    });
    it('finds a collection by its name', async () => {
        await book(membership('Astérix', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionListPageDto>('/collections?search=asterix');

        expect(response.body.items.map((item) => item.name)).toEqual(['Astérix']);
    });
    it('pages the collections', async () => {
        await book(membership('Dune', 1));
        await book(membership('Batman', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionListPageDto>('/collections?offset=1&limit=1');

        expect(response.body).toMatchObject({ total: 2, items: [{ name: 'Dune' }] });
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        const response = await client.call('/collections');

        expect(response.status).toBe(401);
    });
});

describe('GET /api/collections/names', () => {
    it('suggests collections by partial name', async () => {
        await book(membership('Batman', 1));
        await book(membership('Dune', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionNameDto[]>('/collections/names?search=bat');

        expect(response.body).toEqual([
            { id: expect.any(String), name: 'Batman', includesVolumeZero: false },
        ]);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        const response = await client.call('/collections/names?search=bat');

        expect(response.status).toBe(401);
    });
});

describe('GET /api/collections/:id', () => {
    it('groups editions under expected volumes', async () => {
        const yearOne = await book(membership('Batman', 1));
        const omnibus = await book(membership('Batman', 1, 3));
        const planned = await book(membership('Batman', 12), { ownership: 'not-owned' });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<CollectionDetailsDto>(
            '/collections/' + yearOne.collection!.id,
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ name: 'Batman', expectedFrom: 1, expectedTo: 12 });
        expect(
            response.body.volumes.map((volume) => [
                volume.from,
                volume.to,
                volume.state,
                volume.books.map((member) => member.id),
            ]),
        ).toEqual([
            [1, 1, 'owned', [yearOne.id, omnibus.id]],
            [2, 2, 'owned', [omnibus.id]],
            [3, 3, 'owned', [omnibus.id]],
            [4, 11, 'inferred', []],
            [12, 12, 'planned', [planned.id]],
        ]);
    });
    it('describes each edition with its publisher and cover version', async () => {
        const saved = await withCover(
            await book(membership('Dune', 1), { publisher: 'Chilton Books' }),
        );
        const client = await app.authenticatedClient(guest);

        const response = await client.call<CollectionDetailsDto>(
            '/collections/' + saved.collection!.id,
        );

        expect(response.status).toBe(200);
        expect(response.body.volumes[0]?.books[0]).toMatchObject({
            id: saved.id,
            publisher: 'Chilton Books',
            hasCover: true,
            updatedAt: saved.updatedAt,
        });
    });
    it('reports an unknown collection', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/collections/' + crypto.randomUUID());

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('collection-missing');
    });
    it('rejects an identifier that is not a UUID', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/collections/batman');

        expect(response.status).toBe(400);
    });
});

describe('GET /api/collections/shopping', () => {
    it('lists unfinished collections, also without known gaps', async () => {
        await book(membership('Tintin', 1));
        await book(membership('Batman', 4));
        await book(membership('Batman', 6), { ownership: 'not-owned' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ShoppingCollectionDto[]>('/collections/shopping');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject([
            { name: 'Batman', expectedCount: 6, ownedCount: 1, missingCount: 5, lastOwned: 4 },
            { name: 'Tintin', expectedCount: 1, ownedCount: 1, missingCount: 0, lastOwned: 1 },
        ]);
    });
    it('hides Finished collections', async () => {
        const saved = await book(membership('Dune', 1));
        const client = await app.authenticatedClient(owner);

        await client.call('/collections/' + saved.collection!.id + '/finish', 'POST');

        const response = await client.call<ShoppingCollectionDto[]>('/collections/shopping');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });
    it('refuses a Guest', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/collections/shopping');

        expect(response.status).toBe(403);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        const response = await client.call('/collections/shopping');

        expect(response.status).toBe(401);
    });
});

describe('GET /api/collections/:id/shopping', () => {
    it('shows the last Owned volume and the missing volumes with their quick add', async () => {
        await book(membership('Dune', 1), { category: 'books', title: 'Dune' });
        const planned = await book(membership('Dune', 3), {
            category: 'books',
            title: 'Children of Dune',
            ownership: 'not-owned',
        });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionShoppingDto>(
            '/collections/' + planned.collection!.id + '/shopping',
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            id: planned.collection!.id,
            name: 'Dune',
            finished: false,
            expectedCount: 3,
            ownedCount: 1,
            lastOwned: { volume: 1, title: 'Dune' },
            missing: [
                { volume: 2, saved: false, quickAdd: null },
                {
                    volume: 3,
                    saved: true,
                    quickAdd: { bookId: planned.id, title: 'Children of Dune' },
                },
            ],
        });
    });
    it('offers no quick add for a Not Owned omnibus', async () => {
        const omnibus = await book(membership('Batman', 1, 2), { ownership: 'not-owned' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionShoppingDto>(
            '/collections/' + omnibus.collection!.id + '/shopping',
        );

        expect(response.status).toBe(200);
        expect(response.body.lastOwned).toBeNull();
        expect(response.body.missing).toEqual([
            { volume: 1, saved: true, quickAdd: null },
            { volume: 2, saved: true, quickAdd: null },
        ]);
    });
    it('refuses a Guest', async () => {
        const saved = await book(membership('Batman', 1));
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/collections/' + saved.collection!.id + '/shopping');

        expect(response.status).toBe(403);
    });
    it('reports an unknown collection', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/collections/' + crypto.randomUUID() + '/shopping');

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('collection-missing');
    });
    it('rejects an identifier that is not a UUID', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/collections/batman/shopping');

        expect(response.status).toBe(400);
    });
});

describe('PATCH /api/collections/:id', () => {
    it('renames the collection for every member book', async () => {
        const saved = await book(membership('Batman', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionDetailsDto>(
            '/collections/' + saved.collection!.id,
            'PATCH',
            { name: 'The Batman' },
        );

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('The Batman');
        expect(await app.dependencies.library.collectionOf(saved.id)).toBe('The Batman');
        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({ category: 'collection.updated', outcome: 'successful' }),
        );
    });
    it('refuses the name of another collection', async () => {
        await book(membership('Batman', 1));
        const superman = await book(membership('Superman', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/collections/' + superman.collection!.id, 'PATCH', {
            name: 'BATMAN',
        });

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('collection-name-taken');
    });
    it('refuses to stop including volume 0 while a book covers it', async () => {
        const zero = await book({ ...membership('Batman', 0), enableVolumeZero: true });
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/collections/' + zero.collection!.id, 'PATCH', {
            includesVolumeZero: false,
        });

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('volume-zero-in-use');
    });
    it('rejects an empty change', async () => {
        const saved = await book(membership('Batman', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/collections/' + saved.collection!.id, 'PATCH', {});

        expect(response.status).toBe(400);
    });
    it('refuses a Guest', async () => {
        const saved = await book(membership('Batman', 1));
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/collections/' + saved.collection!.id, 'PATCH', {
            name: 'Other',
        });

        expect(response.status).toBe(403);
    });
    it('reports an unknown collection', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/collections/' + crypto.randomUUID() + '', 'PATCH', {
            name: 'Other',
        });

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('collection-missing');
    });
});

describe('POST /api/collections/:id/finish', () => {
    it('marks a complete collection Finished', async () => {
        const saved = await book(membership('Batman', 1, 3));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionDetailsDto>(
            '/collections/' + saved.collection!.id + '/finish',
            'POST',
        );

        expect(response.status).toBe(200);
        expect(response.body.finished).toBe(true);
    });
    it('refuses while a volume is missing', async () => {
        const saved = await book(membership('Batman', 2));
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/collections/' + saved.collection!.id + '/finish',
            'POST',
        );

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('collection-incomplete');
    });
    it('refuses a Guest', async () => {
        const saved = await book(membership('Batman', 1));
        const client = await app.authenticatedClient(guest);

        const response = await client.call(
            '/collections/' + saved.collection!.id + '/finish',
            'POST',
        );

        expect(response.status).toBe(403);
    });
    it('reports an unknown collection', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/collections/' + crypto.randomUUID() + '/finish',
            'POST',
        );

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('collection-missing');
    });
});

describe('POST /api/collections/:id/reopen', () => {
    it('reopens a Finished collection', async () => {
        const saved = await book(membership('Batman', 1));
        const client = await app.authenticatedClient(owner);

        await client.call('/collections/' + saved.collection!.id + '/finish', 'POST');

        const response = await client.call<CollectionDetailsDto>(
            '/collections/' + saved.collection!.id + '/reopen',
            'POST',
        );

        expect(response.status).toBe(200);
        expect(response.body.finished).toBe(false);
    });
    it('refuses a Guest', async () => {
        const saved = await book(membership('Batman', 1));
        const client = await app.authenticatedClient(guest);

        const response = await client.call(
            '/collections/' + saved.collection!.id + '/reopen',
            'POST',
        );

        expect(response.status).toBe(403);
    });
    it('reports an unknown collection', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/collections/' + crypto.randomUUID() + '/reopen',
            'POST',
        );

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('collection-missing');
    });
});

describe('DELETE /api/collections/:id', () => {
    it('deletes the collection and keeps its books', async () => {
        const saved = await book(membership('Batman', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/collections/' + saved.collection!.id, 'DELETE');

        expect(response.status).toBe(204);
        expect(await app.dependencies.library.bookIds()).toEqual([saved.id]);
        expect(await app.dependencies.library.collectionOf(saved.id)).toBeNull();
        expect(await app.dependencies.library.collectionNames()).toEqual([]);
    });
    it('refuses a Guest', async () => {
        const saved = await book(membership('Batman', 1));
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/collections/' + saved.collection!.id, 'DELETE');

        expect(response.status).toBe(403);
    });
    it('reports an unknown collection', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/collections/' + crypto.randomUUID() + '', 'DELETE');

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('collection-missing');
    });
});

describe('GET /api/collections with filters', () => {
    it('keeps a collection only when one of its books matches every criterion', async () => {
        const client = await app.authenticatedClient(owner);
        const fantasy = (await client.call<TagDto>('/tags', 'POST', { name: 'Fantasy' })).body;

        await book(membership('Batman', 1), { authors: [{ name: 'Frank Miller' }] });
        await book(membership('Batman', 2), { tags: [{ id: fantasy.id }] });
        await book(membership('Dune', 1), {
            authors: [{ name: 'Frank Miller' }],
            tags: [{ id: fantasy.id }],
        });
        const miller = (await client.call<{ id: string }[]>('/authors?search=miller')).body[0]!;

        const response = await client.call<CollectionListPageDto>(
            '/collections?author=' + miller.id + '&tag=' + fantasy.id,
        );

        expect(response.body.items.map((item) => item.name)).toEqual(['Dune']);
    });
    it('keeps whole-collection counts for a collection found through one book', async () => {
        for (let volume = 1; volume <= 8; volume++) {
            await book(membership('Akira', volume));
        }

        await book(membership('Akira', 9), { ownership: 'not-owned', category: 'manga' });
        await book(membership('Akira', 10), { ownership: 'not-owned' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionListPageDto>('/collections?category=manga');

        expect(response.body.items).toEqual([
            expect.objectContaining({ name: 'Akira', ownedCount: 8, expectedCount: 10 }),
        ]);
    });
    it('refuses a reading filter for a Guest', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/collections?reading=unread');

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('reading-filter-unavailable');
    });
});

describe('Generated titles of member books', () => {
    async function generated(collection: MembershipDto) {
        return book(collection, { title: '', category: 'manga' });
    }

    it('renames the generated titles with their collection, keeping supplied ones (examples 2 and 3)', async () => {
        const one = await generated(membership('Gunnm', 1));
        const two = await book(membership('Gunnm', 2), {
            title: 'Tears of an Angel',
            category: 'manga',
        });
        const client = await app.authenticatedClient(owner);

        await client.call('/collections/' + one.collection!.id, 'PATCH', {
            name: 'Battle Angel Alita',
        });

        expect(await app.dependencies.library.title(one.id)).toEqual({
            title: 'Battle Angel Alita Vol. 1',
            titleGenerated: true,
        });
        expect(await app.dependencies.library.title(two.id)).toEqual({
            title: 'Tears of an Angel',
            titleGenerated: false,
        });
    });
    it('records the title changes in the rename operation', async () => {
        const one = await generated(membership('Gunnm', 1));
        const client = await app.authenticatedClient(owner);

        await client.call('/collections/' + one.collection!.id, 'PATCH', { name: 'Alita' });

        const entries = await app.dependencies.audit.entries();
        const renamed = entries.find((entry) => entry.category === 'collection.updated');

        expect(entries).toContainEqual(
            expect.objectContaining({
                category: 'book.retitled',
                operationId: renamed!.operationId,
                subjectId: one.id,
                after: { title: 'Alita Vol. 1', titleGenerated: true },
            }),
        );
    });
    it('changes no title when the rename is refused', async () => {
        const one = await generated(membership('Gunnm', 1));

        await book(membership('Alita', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/collections/' + one.collection!.id, 'PATCH', {
            name: 'ALITA',
        });

        expect(response.status).toBe(409);
        expect(await app.dependencies.library.title(one.id)).toEqual({
            title: 'Gunnm Vol. 1',
            titleGenerated: true,
        });
    });
    it('keeps the generated titles of the books of a deleted collection as supplied (example 5)', async () => {
        const one = await generated(membership('Gunnm', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/collections/' + one.collection!.id, 'DELETE');

        expect(response.status).toBe(204);
        expect(await app.dependencies.library.title(one.id)).toEqual({
            title: 'Gunnm Vol. 1',
            titleGenerated: false,
        });
    });
});
