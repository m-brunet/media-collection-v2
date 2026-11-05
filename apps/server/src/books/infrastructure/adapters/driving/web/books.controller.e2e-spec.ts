import type {
    BookDto,
    BookListPageDto,
    CollectionDetailsDto,
    CollectionListPageDto,
    MembershipDto,
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

    expect(response.status).toBe(201);

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
        expect(response.body.reason).toBe('title-invalid');
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
        expect((await client.call<BookListPageDto>('/books')).body.total).toBe(0);
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
        expect((await client.call('/books/' + one.id)).status).toBe(404);
        expect(
            (
                await client.call<CollectionDetailsDto>(
                    '/collections/' + response.body.collection!.id,
                )
            ).body,
        ).toMatchObject({ bookCount: 1, ownedCount: 3, missingCount: 0 });
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
        expect((await client.call('/books/' + one.id)).status).toBe(200);
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
        expect(
            (await client.call<CollectionListPageDto>('/collections')).body.items.map(
                (item) => item.name,
            ),
        ).toEqual(['Superman']);
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
        expect(
            (await client.call<CollectionDetailsDto>('/collections/' + two.collection!.id)).body,
        ).toMatchObject({ finished: false, missingCount: 1 });
    });
});

describe('DELETE /api/books/:id with a collection', () => {
    it('shrinks the expected range when the highest volume is deleted', async () => {
        await member(membership('Batman', 19));
        const twenty = await member(membership('Batman', 20));
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/' + twenty.id, 'DELETE');

        expect(response.status).toBe(204);
        expect(
            (await client.call<CollectionDetailsDto>('/collections/' + twenty.collection!.id)).body,
        ).toMatchObject({ expectedTo: 19, expectedCount: 19 });
    });
    it('removes the collection with its final book', async () => {
        const book = await member(membership('Batman', 1));
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/' + book.id, 'DELETE');

        expect(response.status).toBe(204);
        expect((await client.call<CollectionListPageDto>('/collections')).body.total).toBe(0);
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
