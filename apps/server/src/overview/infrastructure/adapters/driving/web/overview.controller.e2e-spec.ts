import type {
    BookDto,
    BookcaseDto,
    NewBookDto,
    OverviewDto,
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

// Sends one arranging request, a second after the previous one.
async function arrange<T>(
    path: string,
    method: string,
    body?: object,
    user: UserFixture = owner,
): Promise<T> {
    const client = await app.authenticatedClient(user);

    app.advance(1000);
    const response = await client.call<T>(path, method, body);

    if (response.status >= 300) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

function book(title: string, isbn: string, overrides: Partial<NewBookDto> = {}) {
    return arrange<BookDto>('/books', 'POST', BookInputFixture.of({ title, isbn, ...overrides }));
}

function manga(volumeFrom: number, volumeTo: number, isbn: string) {
    return book('', isbn, {
        category: 'manga',
        collection: { collection: { name: 'Naruto' }, volumeFrom, volumeTo },
    });
}

describe('GET /api/overview', () => {
    it('counts saved Owned editions, an omnibus once, Not Owned books not at all', async () => {
        await manga(1, 3, '9781421539898');
        await manga(4, 4, '9781569319000');
        await book('Emma', '9780141439587', { ownership: 'not-owned' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<OverviewDto>('/overview');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ ownedBooks: 2, collections: 1, lentBooks: 0 });
    });
    it('counts bookcases, shelves and the books currently lent', async () => {
        const oak = await arrange<BookcaseDto>('/bookcases', 'POST', { name: 'Oak' });

        await arrange('/bookcases/' + oak.id + '/shelves', 'POST', { name: 'Top' });
        await arrange('/bookcases/' + oak.id + '/shelves', 'POST', { name: 'Bottom' });
        await arrange('/bookcases', 'POST', { name: 'Hall' });
        const dune = await book('Dune', '9780441172719');

        await arrange('/loans', 'POST', { receiver: { name: 'Sam' }, bookIds: [dune.id] });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<OverviewDto>('/overview');

        expect(response.body).toMatchObject({
            bookcases: 2,
            shelves: 2,
            lentBooks: 1,
            bookcaseList: [
                { id: expect.any(String), name: 'Hall', shelfCount: 0 },
                { id: oak.id, name: 'Oak', shelfCount: 2 },
            ],
        });
    });
    it('lists Owned books by when they were added, with links to their details', async () => {
        const dune = await book('Dune', '9780441172719');

        await book('Emma', '9780141439587', { ownership: 'not-owned' });
        const piranesi = await book('Piranesi', '9781635575637');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<OverviewDto>('/overview');

        expect(response.body.recentlyAdded).toEqual([
            {
                id: piranesi.id,
                title: 'Piranesi',
                authors: ['Susanna Clarke'],
                hasCover: false,
                read: false,
            },
            {
                id: dune.id,
                title: 'Dune',
                authors: ['Susanna Clarke'],
                hasCover: false,
                read: false,
            },
        ]);
    });
    it('keeps the record-added order after a Not Owned book becomes Owned', async () => {
        const emma = await book('Emma', '9780141439587', { ownership: 'not-owned' });

        await book('Dune', '9780441172719');
        await arrange('/books/' + emma.id + '/owned', 'POST');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<OverviewDto>('/overview');

        expect(response.body.recentlyAdded.map((value) => value.title)).toEqual(['Dune', 'Emma']);
    });
    it('gives the viewer their own reading over Owned books only', async () => {
        const dune = await book('Dune', '9780441172719');

        await book('Piranesi', '9781635575637');
        const emma = await book('Emma', '9780141439587', { ownership: 'not-owned' });

        await arrange('/books/' + dune.id + '/reading', 'PUT', { read: true });
        await arrange('/books/' + emma.id + '/reading', 'PUT', { read: true });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<OverviewDto>('/overview');

        expect(response.body.reading).toEqual({ read: 1, notRead: 1 });
        expect(response.body.recentlyAdded.map((value) => [value.title, value.read])).toEqual([
            ['Piranesi', false],
            ['Dune', true],
        ]);
    });
    it('does not show another account reading', async () => {
        const dune = await book('Dune', '9780441172719');

        await arrange('/books/' + dune.id + '/reading', 'PUT', { read: true });
        const client = await app.authenticatedClient(otherOwner);

        const response = await client.call<OverviewDto>('/overview');

        expect(response.body.reading).toEqual({ read: 0, notRead: 1 });
        expect(response.body.recentlyAdded[0]?.read).toBe(false);
    });
    it('gives a Guest the counters without any reading', async () => {
        const dune = await book('Dune', '9780441172719');

        await arrange('/books/' + dune.id + '/reading', 'PUT', { read: true });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<OverviewDto>('/overview');

        expect(response.status).toBe(200);
        expect(response.body.ownedBooks).toBe(1);
        expect(response.body.reading).toBeNull();
        expect(response.body.recentlyAdded.map((value) => value.read)).toEqual([null]);
    });
    it('describes an empty library', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<OverviewDto>('/overview');

        expect(response.body).toEqual({
            ownedBooks: 0,
            collections: 0,
            bookcases: 0,
            shelves: 0,
            lentBooks: 0,
            recentlyAdded: [],
            reading: { read: 0, notRead: 0 },
            bookcaseList: [],
        });
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        const response = await client.call('/overview');

        expect(response.status).toBe(401);
    });
});
