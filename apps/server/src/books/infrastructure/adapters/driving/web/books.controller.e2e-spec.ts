import { LendingArrangement } from '../../../../../../../../tests/api/fixtures/lending-arrangement.js';
import type {
    BookDto,
    BookcaseDto,
    BookListPageDto,
    MembershipDto,
    ShelfDto,
    TagDto,
} from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { BookInputFixture } from '../../../../../../../../tests/api/fixtures/book-input.fixture.js';

let app: TestApp;
const owner = new UserFixture({ username: 'camille', role: 'owner' });
const otherOwner = new UserFixture({ username: 'sam', role: 'owner' });
const guest = new UserFixture({ username: 'morgan', role: 'guest' });

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([owner, otherOwner, guest]);
});
afterEach(async () => {
    await app?.teardown();
});

async function created(overrides: Parameters<typeof BookInputFixture.of>[0] = {}) {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookDto>('/books', 'POST', BookInputFixture.of(overrides));

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

function membership(name: string, volumeFrom: number, volumeTo = volumeFrom): MembershipDto {
    return { collection: { name }, volumeFrom, volumeTo };
}

let edition = 0;

// A book without ISBN in a collection, for coverage scenarios.
async function member(collection: MembershipDto, ownership: 'owned' | 'not-owned' = 'owned') {
    return created({
        title: 'Edition ' + ++edition,
        isbn: null,
        noIsbn: true,
        confirmDistinct: true,
        ownership,
        collection,
    });
}

// The same book information, saved again with other ownership or membership.
function edited(book: BookDto, changes: Parameters<typeof BookInputFixture.of>[0]) {
    const { read: _read, ...input } = BookInputFixture.of({
        title: book.title,
        isbn: null,
        noIsbn: true,
        confirmDistinct: true,
        ...changes,
    });

    return input;
}

describe('POST /api/books', () => {
    it('saves a book for every account to see', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>('/books', 'POST', BookInputFixture.of());

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            title: 'Piranesi',
            isbn: '9781635575637',
            authors: [{ name: 'Susanna Clarke' }],
            priceCents: 1690,
            personal: { read: false, note: null },
        });
    });
    it('converts an ISBN-10', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books',
            'POST',
            BookInputFixture.of({ isbn: '0-306-40615-2' }),
        );

        expect(response.body).toMatchObject({
            isbn: '9780306406157',
            isbnConvertedFromIsbn10: true,
        });
    });
    it('refuses a second record of the same edition and points to it', async () => {
        const first = await created();
        const client = await app.authenticatedClient(otherOwner);

        const response = await client.call('/books', 'POST', BookInputFixture.of());

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
            reason: 'isbn-taken',
            details: { bookId: first.id },
        });
    });
    it('asks before creating an author with a similar name', async () => {
        await created({ authors: [{ name: 'Sam Taylor' }] });
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books',
            'POST',
            BookInputFixture.of({ isbn: '9780306406157', authors: [{ name: 'Sam Tayler' }] }),
        );

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
            reason: 'author-similar',
            details: { name: 'Sam Tayler', candidates: [{ name: 'Sam Taylor' }] },
        });
    });
    it('warns about a possible duplicate of a book without ISBN', async () => {
        await created({ isbn: null, noIsbn: true });
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books',
            'POST',
            BookInputFixture.of({ isbn: null, noIsbn: true }),
        );

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('possible-duplicate');
    });
    it('explains a validation refusal', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books', 'POST', BookInputFixture.of({ title: ' ' }));

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('title-required');
    });
    it('refuses a Guest', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books', 'POST', BookInputFixture.of());

        expect(response.status).toBe(403);
        expect(response.body.reason).toBe('guest-read-only');
    });
    it('refuses a signed-out visitor', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/books', 'POST', BookInputFixture.of());

        expect(response.status).toBe(401);
    });
    it('records the creation in the audit log', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>('/books', 'POST', BookInputFixture.of());

        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'book.created',
                outcome: 'successful',
                actorId: owner.id,
                subjectId: response.body.id,
            }),
        );
    });
});

describe('GET /api/books', () => {
    it('lists books with the viewer reading status', async () => {
        await created({ read: true });
        const client = await app.authenticatedClient(otherOwner);

        const response = await client.call<BookListPageDto>('/books');

        expect(response.body).toMatchObject({
            total: 1,
            items: [{ title: 'Piranesi', authors: ['Susanna Clarke'], read: false }],
        });
    });
    it('searches titles and authors without accents or case', async () => {
        await created({ title: 'Vipère au poing', authors: [{ name: 'Hervé Bazin' }] });
        await created({ isbn: '9780306406157', title: 'Other' });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookListPageDto>('/books?search=HERVE');

        expect(response.body.items.map((item) => item.title)).toEqual(['Vipère au poing']);
    });
    it('searches an underscore literally in author names', async () => {
        await created({ authors: [{ name: 'Author_One' }] });
        await created({
            title: 'Other',
            isbn: '9780306406157',
            authors: [{ name: 'Someone Else' }],
        });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookListPageDto>('/books?search=_');

        expect(response.body.items.map((item) => item.title)).toEqual(['Piranesi']);
    });
    it('searches a backslash literally in titles', async () => {
        await created({ title: 'A\\B' });
        await created({ title: 'Other', isbn: '9780306406157' });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookListPageDto>('/books?search=%5C');

        expect(response.body.items.map((item) => item.title)).toEqual(['A\\B']);
    });
    it('sorts ascending publication dates with undated books last', async () => {
        await created({ title: 'Unknown', publicationYear: null, publicationMonth: null });
        await created({
            title: 'Year only',
            isbn: '9780306406157',
            publicationYear: 2024,
            publicationMonth: null,
        });
        await created({
            title: 'September',
            isbn: '9780140449136',
            publicationYear: 2024,
            publicationMonth: 9,
        });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookListPageDto>('/books?sort=published&direction=asc');

        expect(response.body.items.map((item) => item.title)).toEqual([
            'Year only',
            'September',
            'Unknown',
        ]);
    });
    it('pages the results', async () => {
        await created({ title: 'B' });
        await created({ title: 'A', isbn: '9780306406157' });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookListPageDto>('/books?limit=1&offset=1');

        expect(response.body).toMatchObject({ total: 2, items: [{ title: 'B' }] });
    });
    it('finds a book by part of its ISBN, with or without hyphens', async () => {
        await created();
        await created({ isbn: '9780306406157', title: 'Other' });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookListPageDto>('/books?search=978-1635');

        expect(response.body.items.map((item) => item.title)).toEqual(['Piranesi']);
    });
    it('finds a converted book by its ISBN-10', async () => {
        await created({ isbn: '0306406152' });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookListPageDto>('/books?search=0-306-40615-2');

        expect(response.body.total).toBe(1);
    });
    it('sorts by publication date with unknown dates last', async () => {
        await created({ title: 'Unknown', publicationYear: null, publicationMonth: null });
        await created({ title: 'Old', isbn: '9780306406157', publicationYear: 1990 });
        await created({ title: 'New', isbn: '9780140449136', publicationYear: 2024 });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookListPageDto>('/books?sort=published&direction=desc');

        expect(response.body.items.map((item) => item.title)).toEqual(['New', 'Old', 'Unknown']);
    });
    it('sorts by most recently added', async () => {
        await created({ title: 'First' });
        app.advance(1000);
        await created({ title: 'Second', isbn: '9780306406157' });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookListPageDto>('/books?sort=added&direction=desc');

        expect(response.body.items.map((item) => item.title)).toEqual(['Second', 'First']);
    });
    it('treats search wildcards as plain characters', async () => {
        await created();
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookListPageDto>('/books?search=%25');

        expect(response.body.total).toBe(0);
    });
    it('shows a Guest no reading status', async () => {
        await created();
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookListPageDto>('/books');

        expect(response.body.items[0]!.read).toBeNull();
    });
});

describe('GET /api/books/:id', () => {
    it('shows the book details', async () => {
        const book = await created();
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookDto>('/books/' + book.id);

        expect(response.body).toMatchObject({
            id: book.id,
            publisher: 'Bloomsbury',
            personal: null,
        });
    });
    it('reports a missing book', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books/7a1c1d5e-58a4-4c37-9a5a-5b0d1b6a1f00');

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('book-missing');
    });
});

describe('PUT /api/books/:id', () => {
    it('saves corrected information', async () => {
        const book = await created();
        const client = await app.authenticatedClient(otherOwner);
        const { read: _read, ...input } = BookInputFixture.of({ ownership: 'not-owned' });

        const response = await client.call<BookDto>('/books/' + book.id, 'PUT', input);

        expect(response.status).toBe(200);
        expect(response.body.ownership).toBe('not-owned');
    });
    it('refuses a Guest', async () => {
        const book = await created();
        const client = await app.authenticatedClient(guest);
        const { read: _read, ...input } = BookInputFixture.of();

        const response = await client.call('/books/' + book.id, 'PUT', input);

        expect(response.status).toBe(403);
    });
    it('moves the book to another shelf with other tags', async () => {
        const first = await shelfIn('Oak', 'Top');
        const second = await shelfIn('Study', 'Bottom');
        const book = await created({ shelfId: first.shelf.id, tags: [{ name: 'Fantasy' }] });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books/' + book.id,
            'PUT',
            changed({ shelfId: second.shelf.id, tags: [{ name: 'Adventure' }] }),
        );

        expect(response.status).toBe(200);
        expect(response.body.location?.shelfId).toBe(second.shelf.id);
        expect(response.body.tags.map((value) => value.name)).toEqual(['Adventure']);
    });
    it('clears the location and the tags', async () => {
        const { shelf } = await shelfIn('Oak');
        const book = await created({ shelfId: shelf.id, tags: [{ name: 'Fantasy' }] });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books/' + book.id,
            'PUT',
            changed({ shelfId: null, tags: [] }),
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ location: null, tags: [] });
    });
});

describe('DELETE /api/books/:id', () => {
    it('deletes the book', async () => {
        const book = await created();
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/' + book.id, 'DELETE');

        expect(response.status).toBe(204);
        expect(await app.dependencies.books.books.findById(book.id)).toBeNull();
    });
    it('removes the author no other book uses', async () => {
        const book = await created();
        const client = await app.authenticatedClient(owner);

        await client.call('/books/' + book.id, 'DELETE');

        expect(await app.dependencies.books.authors.list()).toEqual([]);
    });
    it('removes the personal notes and reading statuses of the book', async () => {
        const book = await created({ read: true });
        const client = await app.authenticatedClient(owner);

        await client.call('/books/' + book.id + '/note', 'PUT', { text: 'Mine.' });
        await client.call('/books/' + book.id, 'DELETE');

        expect(await app.dependencies.books.notes.find(owner.id, book.id)).toBeNull();
        expect(await app.dependencies.books.readings.isRead(owner.id, book.id)).toBe(false);
    });
    it('refuses a Guest', async () => {
        const book = await created();
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books/' + book.id, 'DELETE');

        expect(response.status).toBe(403);
    });
});

describe('POST /api/books with a collection', () => {
    it('creates the collection and returns the membership', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books',
            'POST',
            BookInputFixture.of({ collection: membership('Batman', 1, 3) }),
        );

        expect(response.status).toBe(201);
        expect(response.body.collection).toEqual({
            id: expect.any(String),
            name: 'Batman',
            volumeFrom: 1,
            volumeTo: 3,
        });
    });
    it('asks before creating a collection with a similar name', async () => {
        await member(membership('Batman', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books',
            'POST',
            BookInputFixture.of({ collection: membership('Batmen', 2) }),
        );

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
            reason: 'collection-similar',
            details: { name: 'Batmen', candidates: [{ name: 'Batman' }] },
        });
    });
    it('asks to include volume 0 before saving its coverage', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books',
            'POST',
            BookInputFixture.of({ collection: membership('Batman', 0) }),
        );

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('volume-zero-disabled');
        expect(await app.dependencies.library.bookIds()).toEqual([]);
    });
    it('rejects a fractional volume', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books',
            'POST',
            BookInputFixture.of({ collection: membership('Batman', 2.5) }),
        );

        expect(response.status).toBe(400);
    });
    it('blocks a Not Owned volume inside an Owned omnibus', async () => {
        const omnibus = await member(membership('Batman', 1, 3));
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books',
            'POST',
            BookInputFixture.of({ ownership: 'not-owned', collection: membership('Batman', 2) }),
        );

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
            reason: 'coverage-conflict',
            details: { replaceable: false, conflicts: [{ id: omnibus.id }] },
        });
    });
    it('replaces the planned books a purchased omnibus overlaps', async () => {
        const one = await member(membership('Batman', 1), 'not-owned');
        const two = await member(membership('Batman', 2), 'not-owned');
        const three = await member(membership('Batman', 3), 'not-owned');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books',
            'POST',
            BookInputFixture.of({
                collection: membership('Batman', 1, 3),
                replacePlanned: [one.id, two.id, three.id],
            }),
        );

        expect(response.status).toBe(201);
        expect(await app.dependencies.library.bookIds()).not.toContain(one.id);
        expect(
            await app.dependencies.library.collection(response.body.collection!.id),
        ).toMatchObject({
            bookCount: 1,
            ownedCount: 3,
            missingCount: 0,
        });
    });
    it('keeps the planned books when the replacement no longer matches', async () => {
        const one = await member(membership('Batman', 1), 'not-owned');

        await member(membership('Batman', 2), 'not-owned');
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books',
            'POST',
            BookInputFixture.of({
                collection: membership('Batman', 1, 2),
                replacePlanned: [one.id],
            }),
        );

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('coverage-conflict');
        expect(await app.dependencies.library.bookIds()).toContain(one.id);
    });
    it('records the created collection in the operation of the book', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books',
            'POST',
            BookInputFixture.of({ collection: membership('Batman', 1) }),
        );

        const entries = await app.dependencies.audit.entries();
        const saved = entries.find((entry) => entry.category === 'book.created');

        expect(entries).toContainEqual(
            expect.objectContaining({
                operationId: saved?.operationId,
                category: 'collection.created',
                subjectId: response.body.collection?.id,
                after: { name: 'Batman', includesVolumeZero: false, finished: false },
            }),
        );
    });
});

describe('PUT /api/books/:id with a collection', () => {
    it('removes the collection its final book is moved out of', async () => {
        const book = await member(membership('Batman', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books/' + book.id,
            'PUT',
            edited(book, { collection: membership('Superman', 1) }),
        );

        expect(response.status).toBe(200);
        expect(await app.dependencies.library.collectionNames()).toEqual(['Superman']);
    });
    it('reopens a Finished collection when an Owned volume becomes Not Owned', async () => {
        await member(membership('Batman', 1));
        const two = await member(membership('Batman', 2));
        const client = await app.authenticatedClient(owner);

        await client.call('/collections/' + two.collection!.id + '/finish', 'POST');

        const response = await client.call<BookDto>(
            '/books/' + two.id,
            'PUT',
            edited(two, { ownership: 'not-owned', collection: membership('Batman', 2) }),
        );

        expect(response.status).toBe(200);
        expect(await app.dependencies.library.collection(two.collection!.id)).toMatchObject({
            finished: false,
            missingCount: 1,
        });
    });
    it('records the collections a moved book created and emptied in its operation', async () => {
        const book = await member(membership('Batman', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books/' + book.id,
            'PUT',
            edited(book, { collection: membership('Superman', 1) }),
        );

        const entries = await app.dependencies.audit.entries();
        const updated = entries.find((entry) => entry.category === 'book.updated');

        expect(
            entries
                .filter((entry) => entry.operationId === updated?.operationId)
                .map((entry) => [entry.category, entry.subjectId]),
        ).toEqual([
            ['book.updated', book.id],
            ['collection.created', response.body.collection?.id],
            ['collection.removed', book.collection?.id],
        ]);
    });
});

describe('DELETE /api/books/:id with a collection', () => {
    it('shrinks the expected range when the highest volume is deleted', async () => {
        await member(membership('Batman', 19));
        const twenty = await member(membership('Batman', 20));
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/' + twenty.id, 'DELETE');

        expect(response.status).toBe(204);
        expect(await app.dependencies.library.collection(twenty.collection!.id)).toMatchObject({
            expectedTo: 19,
            expectedCount: 19,
        });
    });
    it('removes the collection with its final book', async () => {
        const book = await member(membership('Batman', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/' + book.id, 'DELETE');

        expect(response.status).toBe(204);
        expect(await app.dependencies.library.collectionNames()).toEqual([]);
    });
    it('records the removed collection in the operation of the deletion', async () => {
        const book = await member(membership('Batman', 1));
        const client = await app.authenticatedClient(owner);

        await client.call('/books/' + book.id, 'DELETE');

        const entries = await app.dependencies.audit.entries();
        const deleted = entries.find((entry) => entry.category === 'book.deleted');

        expect(entries).toContainEqual(
            expect.objectContaining({
                operationId: deleted?.operationId,
                category: 'collection.removed',
                subjectId: book.collection!.id,
                after: null,
            }),
        );
    });
});

describe('GET /api/books with collections', () => {
    it('finds books by collection name and shows their volumes', async () => {
        await member(membership('Astérix', 4));
        await created({ isbn: '9780306406157', title: 'Standalone' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookListPageDto>('/books?search=asterix');

        expect(response.body.items).toEqual([
            expect.objectContaining({
                collection: { name: 'Astérix', volumeFrom: 4, volumeTo: 4 },
            }),
        ]);
    });
});

// Creates a bookcase with one shelf through the API, as an Owner.
async function shelfIn(bookcaseName: string, shelfName = 'Top') {
    const client = await app.authenticatedClient(owner);
    const bookcase = (await client.call<BookcaseDto>('/bookcases', 'POST', { name: bookcaseName }))
        .body;
    const shelf = (
        await client.call<ShelfDto>('/bookcases/' + bookcase.id + '/shelves', 'POST', {
            name: shelfName,
        })
    ).body;

    return { bookcase, shelf };
}

// Creates a tag through the API, as an Owner.
async function tag(name: string) {
    const client = await app.authenticatedClient(owner);

    return (await client.call<TagDto>('/tags', 'POST', { name })).body;
}

// Books tagged Fantasy and/or Adventure and/or Medieval; the query includes the first two and
// excludes Medieval.
async function taggedBooks() {
    const fantasy = await tag('Fantasy');
    const adventure = await tag('Adventure');
    const medieval = await tag('Medieval');

    await created({
        title: 'Both',
        isbn: null,
        noIsbn: true,
        confirmDistinct: true,
        tags: [{ id: fantasy.id }, { id: adventure.id }],
    });
    await created({
        title: 'Both and medieval',
        isbn: null,
        noIsbn: true,
        confirmDistinct: true,
        tags: [{ id: fantasy.id }, { id: adventure.id }, { id: medieval.id }],
    });
    await created({
        title: 'Only fantasy',
        isbn: null,
        noIsbn: true,
        confirmDistinct: true,
        tags: [{ id: fantasy.id }],
    });
    await created({
        title: 'Other both',
        isbn: null,
        noIsbn: true,
        confirmDistinct: true,
        tags: [{ id: fantasy.id }, { id: adventure.id }],
    });

    return 'tag=' + fantasy.id + '&tag=' + adventure.id + '&notTag=' + medieval.id;
}

// The default book information, without the creator's reading status, for a PUT.
function changed(overrides: Parameters<typeof BookInputFixture.of>[0]) {
    const { read: _read, ...input } = BookInputFixture.of(overrides);

    return input;
}

// The titles listed for a query, in listing order.
async function titles(query: string, user = owner) {
    const client = await app.authenticatedClient(user);
    const response = await client.call<BookListPageDto>('/books?' + query);

    if (response.status !== 200) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body.items.map((item) => item.title);
}

describe('POST /api/books with a location and tags', () => {
    it('keeps the book on the shelf with its tags, reusing an equivalent tag', async () => {
        const { shelf } = await shelfIn('Oak bookcase', 'Shelf 3');
        const fantasy = await tag('Médiéval');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books',
            'POST',
            BookInputFixture.of({
                shelfId: shelf.id,
                tags: [{ name: ' medieval' }, { name: 'Adventure' }],
            }),
        );

        expect(response.status).toBe(201);
        expect(response.body.location).toEqual({
            bookcaseId: shelf.bookcaseId,
            bookcaseName: 'Oak bookcase',
            shelfId: shelf.id,
            shelfName: 'Shelf 3',
        });
        expect(response.body.tags).toEqual([
            { id: expect.any(String), name: 'Adventure' },
            { id: fantasy.id, name: 'Médiéval' },
        ]);
    });
    it('records the tag it created in the operation of the book', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books',
            'POST',
            BookInputFixture.of({ tags: [{ name: 'Adventure' }] }),
        );

        const entries = await app.dependencies.audit.entries();
        const saved = entries.find((entry) => entry.category === 'book.created');

        expect(entries).toContainEqual(
            expect.objectContaining({
                operationId: saved?.operationId,
                category: 'tag.created',
                subjectId: response.body.tags[0]?.id,
            }),
        );
    });
    it('refuses an unknown shelf and saves nothing', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books',
            'POST',
            BookInputFixture.of({ shelfId: crypto.randomUUID() }),
        );

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('shelf-missing');
        expect(await app.dependencies.library.bookIds()).toEqual([]);
    });
});

describe('PATCH /api/books/:id/organisation', () => {
    it('places a book on a shelf without changing its information', async () => {
        const { shelf } = await shelfIn('Oak');
        const book = await created();
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books/' + book.id + '/organisation',
            'PATCH',
            {
                shelfId: shelf.id,
            },
        );

        expect(response.status).toBe(200);
        expect(response.body.location?.shelfId).toBe(shelf.id);
        expect(response.body.title).toBe(book.title);
        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'book.organised',
                subjectId: book.id,
                before: { location: null, tags: [] },
            }),
        );
    });
    it('replaces the tags, keeping the location', async () => {
        const { shelf } = await shelfIn('Oak');
        const book = await created({ shelfId: shelf.id, tags: [{ name: 'Fantasy' }] });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books/' + book.id + '/organisation',
            'PATCH',
            {
                tags: [{ name: 'Adventure' }],
            },
        );

        expect(response.body.tags.map((value) => value.name)).toEqual(['Adventure']);
        expect(response.body.location?.shelfId).toBe(shelf.id);
    });
    it('removes a tag from the book', async () => {
        const fantasy = await tag('Fantasy');
        const book = await created({ tags: [{ id: fantasy.id }] });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books/' + book.id + '/organisation',
            'PATCH',
            {
                tags: [],
            },
        );

        expect(response.status).toBe(200);
        expect(response.body.tags).toEqual([]);
    });
    it('refuses a request without any change', async () => {
        const book = await created();
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/' + book.id + '/organisation', 'PATCH', {});

        expect(response.status).toBe(400);
    });
    it('reports an unknown book', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books/' + crypto.randomUUID() + '/organisation',
            'PATCH',
            { shelfId: null },
        );

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('book-missing');
    });
    it('refuses a Guest', async () => {
        const book = await created();
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books/' + book.id + '/organisation', 'PATCH', {
            tags: [{ name: 'Fantasy' }],
        });

        expect(response.status).toBe(403);
        expect(response.body.reason).toBe('guest-read-only');
    });
    it('reports an unknown shelf without changing the book', async () => {
        const { shelf } = await shelfIn('Oak');
        const book = await created({ shelfId: shelf.id });
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/' + book.id + '/organisation', 'PATCH', {
            shelfId: crypto.randomUUID(),
        });

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('shelf-missing');
        expect(await app.dependencies.library.location(book.id)).toEqual({
            bookcaseName: 'Oak',
            shelfName: 'Top',
        });
    });
    it('reports an unknown tag', async () => {
        const book = await created();
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/' + book.id + '/organisation', 'PATCH', {
            tags: [{ id: crypto.randomUUID() }],
        });

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('tag-missing');
    });
    it('refuses a malformed request', async () => {
        const book = await created();
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/' + book.id + '/organisation', 'PATCH', {
            shelfId: 'top',
            tags: 'Fantasy',
        });

        expect(response.status).toBe(400);
    });
    it('refuses a signed-out visitor', async () => {
        const book = await created();
        const client = app.client();

        await client.prepare();

        const response = await client.call('/books/' + book.id + '/organisation', 'PATCH', {
            tags: [],
        });

        expect(response.status).toBe(401);
    });
});

describe('GET /api/books with filters', () => {
    it('accepts any selected category but requires ownership and location too', async () => {
        const { bookcase, shelf } = await shelfIn('Bookcase A');
        const elsewhere = await shelfIn('Bookcase B');

        await member(membership('Akira', 1));
        await created({
            title: 'Manga A',
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            category: 'manga',
            shelfId: shelf.id,
        });
        await created({
            title: 'Comics A',
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            category: 'comics',
            shelfId: shelf.id,
        });
        await created({
            title: 'Comics planned',
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            category: 'comics',
            ownership: 'not-owned',
            shelfId: shelf.id,
        });
        await created({
            title: 'Manga B',
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            category: 'manga',
            shelfId: elsewhere.shelf.id,
        });

        const result = await titles(
            'category=manga&category=comics&ownership=owned&location=bookcase:' + bookcase.id,
        );

        expect(result).toEqual(['Comics A', 'Manga A']);
    });
    it('requires every included tag and rejects any excluded tag', async () => {
        const query = await taggedBooks();

        const result = await titles(query);

        expect(result).toEqual(['Both', 'Other both']);
    });
    it('narrows the tag filter with the search text', async () => {
        const query = await taggedBooks();

        const result = await titles(query + '&search=other');

        expect(result).toEqual(['Other both']);
    });
    it('selects books without a location or a collection', async () => {
        const { shelf } = await shelfIn('Oak');

        await member(membership('Batman', 1));
        await created({
            title: 'Shelved',
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            shelfId: shelf.id,
        });
        await created({ title: 'Loose', isbn: null, noIsbn: true });

        const result = await titles('location=none&collection=none');

        expect(result).toEqual(['Loose']);
    });
    it('accepts a chosen collection or no collection together', async () => {
        const batman = await member(membership('Batman', 1));

        await member(membership('Dune', 1));
        await created({ title: 'Standalone', isbn: null, noIsbn: true });

        const result = await titles('collection=' + batman.collection!.id + '&collection=none');

        expect(result).toEqual([batman.title, 'Standalone']);
    });
    it('filters on the authors and on a specific shelf', async () => {
        const { shelf } = await shelfIn('Oak', 'Shelf 3');
        const clarke = await created({ shelfId: shelf.id });

        await created({
            title: 'Dune',
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            authors: [{ name: 'Frank Herbert' }],
            shelfId: shelf.id,
        });

        const result = await titles(
            'author=' + clarke.authors[0]!.id + '&location=shelf:' + shelf.id,
        );

        expect(result).toEqual(['Piranesi']);
    });
    it('filters on the reader own reading status', async () => {
        const client = await app.authenticatedClient(owner);

        await client.call(
            '/books',
            'POST',
            BookInputFixture.of({
                title: 'Read',
                isbn: null,
                noIsbn: true,
                confirmDistinct: true,
                read: true,
            }),
        );
        await created({ title: 'Unread', isbn: null, noIsbn: true });

        const result = await titles('reading=unread');

        expect(result).toEqual(['Unread']);
    });
    it('filters on the reading status of the signed-in reader only', async () => {
        const client = await app.authenticatedClient(owner);

        await client.call(
            '/books',
            'POST',
            BookInputFixture.of({ title: 'Read', isbn: null, noIsbn: true, read: true }),
        );

        const result = await titles('reading=read', otherOwner);

        expect(result).toEqual([]);
    });
    it('refuses a reading filter for a Guest', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books?reading=read');

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('reading-filter-unavailable');
    });
    it('refuses a malformed location', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books?location=room:kitchen');

        expect(response.status).toBe(400);
    });
});

// Lends saved books to a receiver, through the builders.
async function lentTo(receiverName: string, ...books: BookDto[]) {
    return new LendingArrangement(app.dependencies).lend({ name: receiverName }, ...books);
}

// Records the return of loans, through the builders.
async function returned(...loanIds: string[]) {
    await new LendingArrangement(app.dependencies).giveBack(...loanIds);
}

describe('GET /api/books/:id of a lent book', () => {
    it('shows who has it and since when, keeping location, tags and reading status', async () => {
        const { shelf } = await shelfIn('Oak');
        const fantasy = await tag('Fantasy');
        const book = await created({
            read: true,
            shelfId: shelf.id,
            tags: [{ id: fantasy.id }],
            collection: membership('Southern Reach', 1),
        });
        const lending = await lentTo('Sam Taylor', book);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>('/books/' + book.id);

        expect(response.body).toMatchObject({
            ownership: 'owned',
            location: book.location,
            tags: book.tags,
            collection: book.collection,
            personal: { read: true },
            loan: {
                id: lending.loans[0]!.loanId,
                receiverId: lending.receiver.id,
                receiverName: 'Sam Taylor',
                lentAt: lending.loans[0]!.lentAt,
            },
        });
    });
    it('shows a Guest who has it', async () => {
        const book = await created();

        await lentTo('Sam Taylor', book);
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookDto>('/books/' + book.id);

        expect(response.body.loan?.receiverName).toBe('Sam Taylor');
    });
    it('shows no loan once the book is returned, keeping it Owned', async () => {
        const book = await created();
        const lending = await lentTo('Sam Taylor', book);

        await returned(lending.loans[0]!.loanId);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>('/books/' + book.id);

        expect(response.body).toMatchObject({ ownership: 'owned', loan: null });
    });
});

describe('GET /api/books with lent books', () => {
    it('marks the lent books of the list with their loan', async () => {
        const lent = await created({ title: 'Dune', isbn: null, noIsbn: true });
        const kept = await created({
            title: 'Piranesi',
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
        });

        await lentTo('Sam Taylor', lent);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookListPageDto>('/books');

        expect(
            response.body.items.map((item) => [item.id, item.loan?.receiverName ?? null]),
        ).toEqual([
            [lent.id, 'Sam Taylor'],
            [kept.id, null],
        ]);
    });
});

describe('DELETE /api/books/:id of a lent book', () => {
    it('refuses to delete a lent book, keeping it', async () => {
        const book = await created();

        await lentTo('Sam Taylor', book);
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/' + book.id, 'DELETE');

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
            reason: 'book-lent',
            details: { receiverName: 'Sam Taylor' },
        });
        expect(await app.dependencies.library.bookIds()).toEqual([book.id]);
    });
    it('keeps the completed loan of a deleted book, identified by its former title and ISBN', async () => {
        const book = await created({ title: 'Piranesi', isbn: '9781635575637' });
        const lending = await lentTo('Sam Taylor', book);

        await returned(lending.loans[0]!.loanId);
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/' + book.id, 'DELETE');

        expect(response.status).toBe(204);
        expect(await app.dependencies.library.loans()).toEqual([
            {
                bookId: null,
                receiverName: 'Sam Taylor',
                status: 'returned',
                bookTitle: 'Piranesi',
                bookIsbn: '9781635575637',
            },
        ]);
    });
});

describe('PUT /api/books/:id of a lent book', () => {
    it('refuses to change a lent book to Not Owned, keeping it Owned', async () => {
        const book = await created();

        await lentTo('Sam Taylor', book);
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books/' + book.id,
            'PUT',
            changed({ ownership: 'not-owned' }),
        );

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('book-lent');
        expect(await app.dependencies.library.ownership(book.id)).toBe('owned');
    });
    it('saves other changes of a lent book', async () => {
        const book = await created();

        await lentTo('Sam Taylor', book);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books/' + book.id,
            'PUT',
            changed({ title: 'Piranesi (paperback)' }),
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            title: 'Piranesi (paperback)',
            loan: expect.objectContaining({ receiverName: 'Sam Taylor' }),
        });
    });
});

describe('Generated titles of books', () => {
    const gunnm = () => membership('Gunnm', 3);

    // A Manga of Gunnm saved without title, so its title is generated.
    async function generated() {
        return created({
            title: '',
            isbn: null,
            noIsbn: true,
            category: 'manga',
            collection: gunnm(),
        });
    }

    it('names a Manga saved without title after its collection (example 1)', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books',
            'POST',
            BookInputFixture.of({
                title: ' ',
                isbn: null,
                noIsbn: true,
                category: 'manga',
                collection: gunnm(),
            }),
        );

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ title: 'Gunnm - 3', titleGenerated: true });
        expect(await app.dependencies.library.title(response.body.id)).toEqual({
            title: 'Gunnm - 3',
            titleGenerated: true,
        });
    });
    it('refuses a blank title for a Manga outside any collection', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books',
            'POST',
            BookInputFixture.of({ title: '', category: 'manga' }),
        );

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('title-required');
    });
    it('keeps generation through an unrelated edit (example 3)', async () => {
        const book = await generated();
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books/' + book.id,
            'PUT',
            edited(book, { title: '', category: 'manga', collection: gunnm(), pageCount: 199 }),
        );

        expect(response.body).toMatchObject({ title: 'Gunnm - 3', titleGenerated: true });
    });
    it('regenerates the title of a book given more volumes (example 3)', async () => {
        const book = await generated();
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books/' + book.id,
            'PUT',
            edited(book, { title: '', category: 'manga', collection: membership('Gunnm', 3, 4) }),
        );

        expect(response.body.title).toBe('Gunnm - 3–4');
    });
    it('requires a title when the book leaves its collection, changing nothing (example 4)', async () => {
        const book = await generated();
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books/' + book.id,
            'PUT',
            edited(book, { title: '', category: 'manga', collection: null }),
        );

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('title-required');
        expect(await app.dependencies.library.title(book.id)).toEqual({
            title: 'Gunnm - 3',
            titleGenerated: true,
        });
    });
    it('saves the accepted last generated title as supplied (example 4)', async () => {
        const book = await generated();
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookDto>(
            '/books/' + book.id,
            'PUT',
            edited(book, { title: 'Gunnm - 3', category: 'books', collection: null }),
        );

        expect(response.body).toMatchObject({ title: 'Gunnm - 3', titleGenerated: false });
    });
});
