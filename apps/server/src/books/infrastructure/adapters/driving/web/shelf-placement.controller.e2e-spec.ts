import type {
    ActivityPageDto,
    BookcaseDto,
    BookDto,
    BookListPageDto,
    NewBookDto,
    ShelfDto,
    ShelfPlacementDto,
} from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { BookInputFixture } from '../../../../../../../../tests/api/fixtures/book-input.fixture.js';
import { LendingArrangement } from '../../../../../../../../tests/api/fixtures/lending-arrangement.js';

let app: TestApp;
let counter = 0;
const owner = new UserFixture({ username: 'camille', role: 'owner' });
const administrator = new UserFixture({ username: 'alex', role: 'admin' });
const guest = new UserFixture({ username: 'morgan', role: 'guest' });

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([owner, administrator, guest]);
});
afterEach(async () => {
    await app?.teardown();
});

async function book(overrides: Partial<NewBookDto> = {}): Promise<BookDto> {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookDto>(
        '/books',
        'POST',
        BookInputFixture.of({
            title: 'Gunnm ' + ++counter,
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            publisher: null,
            ...overrides,
        }),
    );

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

async function shelf(bookcaseName: string, shelfName: string): Promise<ShelfDto> {
    const client = await app.authenticatedClient(owner);
    const bookcase = (await client.call<BookcaseDto>('/bookcases', 'POST', { name: bookcaseName }))
        .body;

    return (
        await client.call<ShelfDto>('/bookcases/' + bookcase.id + '/shelves', 'POST', {
            name: shelfName,
        })
    ).body;
}

async function shelfOf(bookId: string): Promise<string | null> {
    const client = await app.authenticatedClient(owner);

    return (await client.call<BookDto>('/books/' + bookId)).body.location?.shelfId ?? null;
}

const unknownId = '00000000-0000-4000-8000-000000000000';

describe('POST /api/books/shelf-placement', () => {
    it('places books without a location and moves a book from another shelf', async () => {
        const target = await shelf('Oak', 'Shelf 3');
        const other = await shelf('Hallway', 'Shelf 1');
        const first = await book();
        const second = await book({ shelfId: other.id });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ShelfPlacementDto>('/books/shelf-placement', 'POST', {
            shelfId: target.id,
            bookIds: [first.id, second.id],
        });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            shelf: {
                bookcaseId: target.bookcaseId,
                bookcaseName: 'Oak',
                shelfId: target.id,
                shelfName: 'Shelf 3',
            },
            placed: [{ id: first.id, title: first.title }],
            moved: [
                {
                    id: second.id,
                    title: second.title,
                    from: expect.objectContaining({
                        bookcaseName: 'Hallway',
                        shelfName: 'Shelf 1',
                    }),
                },
            ],
            unchanged: [],
        });
        expect([await shelfOf(first.id), await shelfOf(second.id)]).toEqual([target.id, target.id]);
    });
    it('reports a book already on the shelf as unchanged', async () => {
        const target = await shelf('Oak', 'Shelf 3');
        const there = await book({ shelfId: target.id });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ShelfPlacementDto>('/books/shelf-placement', 'POST', {
            shelfId: target.id,
            bookIds: [there.id],
        });

        expect([response.status, response.body.unchanged]).toEqual([
            200,
            [{ id: there.id, title: there.title }],
        ]);
    });
    it('places a lent book', async () => {
        const target = await shelf('Oak', 'Shelf 3');
        const lent = await book();

        await new LendingArrangement(app.dependencies).lend({ name: 'Sam Taylor' }, lent);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ShelfPlacementDto>('/books/shelf-placement', 'POST', {
            shelfId: target.id,
            bookIds: [lent.id],
        });

        expect(response.status).toBe(200);
        expect(await shelfOf(lent.id)).toBe(target.id);
    });
    it('lets an Admin place books', async () => {
        const target = await shelf('Oak', 'Shelf 3');
        const first = await book();
        const client = await app.authenticatedClient(administrator);

        const response = await client.call('/books/shelf-placement', 'POST', {
            shelfId: target.id,
            bookIds: [first.id],
        });

        expect(response.status).toBe(200);
    });
    it('shows one Activity entry for the whole placement', async () => {
        const target = await shelf('Oak', 'Shelf 3');
        const first = await book();
        const second = await book();
        const client = await app.authenticatedClient(owner);

        await client.call('/books/shelf-placement', 'POST', {
            shelfId: target.id,
            bookIds: [first.id, second.id],
        });

        const activity = await client.call<ActivityPageDto>('/activity');

        expect(activity.body.entries).toContainEqual(
            expect.objectContaining({
                event: { kind: 'books-placed', shelf: 'Shelf 3', bookcase: 'Oak', count: 2 },
                also: [],
            }),
        );
    });
    it('refuses an unknown shelf', async () => {
        const first = await book();
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/shelf-placement', 'POST', {
            shelfId: unknownId,
            bookIds: [first.id],
        });

        expect(response.status).toBe(404);
    });
    it('refuses an unknown book and places none of the others', async () => {
        const target = await shelf('Oak', 'Shelf 3');
        const first = await book();
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/shelf-placement', 'POST', {
            shelfId: target.id,
            bookIds: [first.id, unknownId],
        });

        expect(response.status).toBe(404);
        expect(await shelfOf(first.id)).toBeNull();
    });
    it('refuses a Not Owned book and places none of the others', async () => {
        const target = await shelf('Oak', 'Shelf 3');
        const first = await book();
        const planned = await book({ ownership: 'not-owned' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/shelf-placement', 'POST', {
            shelfId: target.id,
            bookIds: [first.id, planned.id],
        });

        expect(response.status).toBe(400);
        expect(await shelfOf(first.id)).toBeNull();
    });
    it('rejects an empty list of books', async () => {
        const target = await shelf('Oak', 'Shelf 3');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/shelf-placement', 'POST', {
            shelfId: target.id,
            bookIds: [],
        });

        expect(response.status).toBe(400);
    });
    it('rejects more than a hundred books', async () => {
        const target = await shelf('Oak', 'Shelf 3');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/shelf-placement', 'POST', {
            shelfId: target.id,
            bookIds: Array.from({ length: 101 }, () => unknownId),
        });

        expect(response.status).toBe(400);
    });
    it('rejects an identifier that is not one', async () => {
        const target = await shelf('Oak', 'Shelf 3');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/shelf-placement', 'POST', {
            shelfId: target.id,
            bookIds: ['book-1'],
        });

        expect(response.status).toBe(400);
    });
    it('refuses a Guest and places nothing', async () => {
        const target = await shelf('Oak', 'Shelf 3');
        const first = await book();
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books/shelf-placement', 'POST', {
            shelfId: target.id,
            bookIds: [first.id],
        });

        expect(response.status).toBe(403);
        expect(await shelfOf(first.id)).toBeNull();
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/books/shelf-placement', 'POST', {
            shelfId: unknownId,
            bookIds: [unknownId],
        });

        expect(response.status).toBe(401);
    });
});

describe('GET /api/books, the location of each book', () => {
    it('gives the shelf and bookcase of a placed book, and none otherwise', async () => {
        const target = await shelf('Oak', 'Shelf 3');
        const placed = await book({ title: 'A placed', shelfId: target.id });

        await book({ title: 'B loose' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookListPageDto>('/books?sort=title');

        expect(response.body.items.map((item) => [item.title, item.location])).toEqual([
            [
                placed.title,
                {
                    bookcaseId: target.bookcaseId,
                    bookcaseName: 'Oak',
                    shelfId: target.id,
                    shelfName: 'Shelf 3',
                },
            ],
            ['B loose', null],
        ]);
    });
});
