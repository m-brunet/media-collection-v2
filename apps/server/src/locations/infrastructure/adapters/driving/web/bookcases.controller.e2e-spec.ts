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

async function bookcase(name: string) {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookcaseDto>('/bookcases', 'POST', { name });

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

async function shelf(bookcaseId: string, name: string) {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<ShelfDto>('/bookcases/' + bookcaseId + '/shelves', 'POST', {
        name,
    });

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

async function bookOn(shelfId: string) {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookDto>('/books', 'POST', BookInputFixture.of({ shelfId }));

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

describe('GET /api/bookcases', () => {
    it('lists bookcases with their shelves and book counts, empty ones included', async () => {
        const oak = await bookcase('Oak bookcase');
        const shelf3 = await shelf(oak.id, 'Shelf 3');
        const hall = await bookcase('Hall');

        await bookOn(shelf3.id);
        const client = await app.authenticatedClient(guest);

        const response = await client.call<BookcaseDto[]>('/bookcases');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            { id: hall.id, name: 'Hall', bookCount: 0, shelves: [] },
            {
                id: oak.id,
                name: 'Oak bookcase',
                bookCount: 1,
                shelves: [{ id: shelf3.id, bookcaseId: oak.id, name: 'Shelf 3', bookCount: 1 }],
            },
        ]);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        const response = await client.call('/bookcases');

        expect(response.status).toBe(401);
    });
});

describe('POST /api/bookcases', () => {
    it('creates an empty bookcase', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookcaseDto>('/bookcases', 'POST', { name: ' Oak ' });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
            id: expect.any(String),
            name: 'Oak',
            bookCount: 0,
            shelves: [],
        });
        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'bookcase.created',
                outcome: 'successful',
                subjectId: response.body.id,
            }),
        );
    });
    it('refuses an equivalent bookcase name', async () => {
        await bookcase('Étude');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/bookcases', 'POST', { name: 'ETUDE' });

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('bookcase-name-taken');
    });
    it('refuses an empty name', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/bookcases', 'POST', { name: '  ' });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('bookcase-name-invalid');
    });
    it('refuses a Guest', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/bookcases', 'POST', { name: 'Oak' });

        expect(response.status).toBe(403);
        expect(response.body.reason).toBe('guest-read-only');
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/bookcases', 'POST', { name: 'Oak' });

        expect(response.status).toBe(401);
    });
});

describe('PATCH /api/bookcases/:id', () => {
    it('renames a bookcase and the location every assigned book shows', async () => {
        const oak = await bookcase('Oak');
        const book = await bookOn((await shelf(oak.id, 'Top')).id);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookcaseDto>('/bookcases/' + oak.id, 'PATCH', {
            name: 'Oak bookcase',
        });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Oak bookcase');
        expect(await app.dependencies.library.location(book.id)).toEqual({
            bookcaseName: 'Oak bookcase',
            shelfName: 'Top',
        });
    });
    it('refuses the name of another bookcase', async () => {
        const oak = await bookcase('Oak');

        await bookcase('Hall');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/bookcases/' + oak.id, 'PATCH', { name: 'hall' });

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('bookcase-name-taken');
    });
    it('reports an unknown bookcase', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/bookcases/' + crypto.randomUUID(), 'PATCH', {
            name: 'Hall',
        });

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('bookcase-missing');
    });
    it('refuses a Guest', async () => {
        const oak = await bookcase('Oak');
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/bookcases/' + oak.id, 'PATCH', { name: 'Hall' });

        expect(response.status).toBe(403);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/bookcases/' + crypto.randomUUID(), 'PATCH', {
            name: 'Oak',
        });

        expect(response.status).toBe(401);
    });
});

describe('DELETE /api/bookcases/:id', () => {
    it('removes the bookcase and its shelves, keeping their books unassigned', async () => {
        const oak = await bookcase('Oak');
        const book = await bookOn((await shelf(oak.id, 'Top')).id);
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/bookcases/' + oak.id, 'DELETE');

        expect(response.status).toBe(204);
        expect(await app.dependencies.library.bookcases()).toEqual([]);
        expect(await app.dependencies.library.bookIds()).toEqual([book.id]);
        expect(await app.dependencies.library.location(book.id)).toBeNull();
        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'bookcase.deleted',
                before: { name: 'Oak', shelves: ['Top'], unassignedBooks: 1 },
            }),
        );
    });
    it('reports an unknown bookcase', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/bookcases/' + crypto.randomUUID(), 'DELETE');

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('bookcase-missing');
    });
    it('refuses a Guest', async () => {
        const oak = await bookcase('Oak');
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/bookcases/' + oak.id, 'DELETE');

        expect(response.status).toBe(403);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/bookcases/' + crypto.randomUUID(), 'DELETE');

        expect(response.status).toBe(401);
    });
});

describe('POST /api/bookcases/:id/shelves', () => {
    it('creates an empty shelf inside the bookcase', async () => {
        const oak = await bookcase('Oak');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ShelfDto>('/bookcases/' + oak.id + '/shelves', 'POST', {
            name: 'Shelf 4',
        });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
            id: expect.any(String),
            bookcaseId: oak.id,
            name: 'Shelf 4',
            bookCount: 0,
        });
        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({ category: 'shelf.created', subjectId: response.body.id }),
        );
    });
    it('accepts a shelf name another bookcase uses', async () => {
        await shelf((await bookcase('Oak')).id, 'Top');
        const study = await bookcase('Study');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/bookcases/' + study.id + '/shelves', 'POST', {
            name: 'Top',
        });

        expect(response.status).toBe(201);
    });
    it('refuses an equivalent shelf name in the same bookcase', async () => {
        const oak = await bookcase('Oak');

        await shelf(oak.id, 'Top');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/bookcases/' + oak.id + '/shelves', 'POST', {
            name: 'TOP',
        });

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('shelf-name-taken');
    });
    it('reports an unknown bookcase', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/bookcases/' + crypto.randomUUID() + '/shelves',
            'POST',
            { name: 'Top' },
        );

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('bookcase-missing');
    });
    it('refuses a Guest', async () => {
        const oak = await bookcase('Oak');
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/bookcases/' + oak.id + '/shelves', 'POST', {
            name: 'Top',
        });

        expect(response.status).toBe(403);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call(
            '/bookcases/' + crypto.randomUUID() + '/shelves',
            'POST',
            { name: 'Top' },
        );

        expect(response.status).toBe(401);
    });
});
