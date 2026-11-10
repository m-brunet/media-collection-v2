import type {
    BookcaseDto,
    BookDto,
    ShelfDto,
} from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { BookInputFixture } from '../../../../../../../../tests/api/fixtures/book-input.fixture.js';

let app: TestApp;
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

async function location(bookcaseName: string, shelfName: string) {
    const client = await app.authenticatedClient(owner);
    const bookcase = (await client.call<BookcaseDto>('/bookcases', 'POST', { name: bookcaseName }))
        .body;
    const response = await client.call<ShelfDto>('/bookcases/' + bookcase.id + '/shelves', 'POST', {
        name: shelfName,
    });

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return { bookcase, shelf: response.body };
}

async function bookOn(shelfId: string) {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookDto>('/books', 'POST', BookInputFixture.of({ shelfId }));

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

describe('PATCH /api/shelves/:id', () => {
    it('renames a shelf and the location its books show', async () => {
        const { shelf } = await location('Oak', 'Shelf 3');
        const book = await bookOn(shelf.id);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ShelfDto>('/shelves/' + shelf.id, 'PATCH', {
            name: 'Top',
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ name: 'Top', bookCount: 1 });
        expect(await app.dependencies.library.location(book.id)).toEqual({
            bookcaseName: 'Oak',
            shelfName: 'Top',
        });
        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({ category: 'shelf.renamed', subjectId: shelf.id }),
        );
    });
    it('moves a shelf with its books into another bookcase', async () => {
        const { shelf } = await location('Oak', 'Top');
        const { bookcase: study } = await location('Study', 'Bottom');
        const book = await bookOn(shelf.id);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ShelfDto>('/shelves/' + shelf.id, 'PATCH', {
            bookcaseId: study.id,
        });

        expect(response.status).toBe(200);
        expect(response.body.bookcaseId).toBe(study.id);
        expect(await app.dependencies.library.location(book.id)).toEqual({
            bookcaseName: 'Study',
            shelfName: 'Top',
        });
        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'shelf.moved',
                before: expect.objectContaining({ bookcaseName: 'Oak' }),
                after: expect.objectContaining({ bookcaseName: 'Study' }),
            }),
        );
    });
    it('refuses a move into a bookcase with an equivalent shelf name', async () => {
        const { shelf } = await location('Oak', 'Top');
        const { bookcase: study } = await location('Study', 'top');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/shelves/' + shelf.id, 'PATCH', {
            bookcaseId: study.id,
        });

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('shelf-name-taken');
    });
    it('refuses a request without any change', async () => {
        const { shelf } = await location('Oak', 'Top');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/shelves/' + shelf.id, 'PATCH', {});

        expect(response.status).toBe(400);
    });
    it('reports an unknown shelf', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/shelves/' + crypto.randomUUID(), 'PATCH', {
            name: 'Top',
        });

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('shelf-missing');
    });
    it('refuses a Guest', async () => {
        const { shelf } = await location('Oak', 'Top');
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/shelves/' + shelf.id, 'PATCH', { name: 'Bottom' });

        expect(response.status).toBe(403);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/shelves/' + crypto.randomUUID(), 'PATCH', {
            name: 'Top',
        });

        expect(response.status).toBe(401);
    });
});

describe('DELETE /api/shelves/:id', () => {
    it('removes the shelf and unassigns its books, which are kept', async () => {
        const { bookcase, shelf } = await location('Oak', 'Shelf 3');
        const book = await bookOn(shelf.id);
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/shelves/' + shelf.id, 'DELETE');

        expect(response.status).toBe(204);
        expect(await app.dependencies.library.bookIds()).toEqual([book.id]);
        expect(await app.dependencies.library.location(book.id)).toBeNull();
        expect(await app.dependencies.library.bookcases()).toEqual([
            { name: bookcase.name, shelves: [] },
        ]);
        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'shelf.deleted',
                before: expect.objectContaining({ name: 'Shelf 3', unassignedBooks: 1 }),
            }),
        );
    });
    it('reports an unknown shelf', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/shelves/' + crypto.randomUUID(), 'DELETE');

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('shelf-missing');
    });
    it('refuses a Guest', async () => {
        const { shelf } = await location('Oak', 'Top');
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/shelves/' + shelf.id, 'DELETE');

        expect(response.status).toBe(403);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/shelves/' + crypto.randomUUID(), 'DELETE');

        expect(response.status).toBe(401);
    });
});
