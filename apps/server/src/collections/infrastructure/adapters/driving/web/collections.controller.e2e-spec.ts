import type {
    BookDto,
    TagDto,
    CollectionDetailsDto,
    CollectionListPageDto,
    CollectionNameDto,
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

// Saves a book without ISBN through the API, as an Owner.
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
