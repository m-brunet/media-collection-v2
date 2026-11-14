import type {
    BookDto,
    NewBookDto,
    StatisticsDto,
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

async function arrange<T>(path: string, method: string, body?: object): Promise<T> {
    const client = await app.authenticatedClient(owner);

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

function naruto(volume: number, isbn: string) {
    return book('', isbn, {
        category: 'manga',
        publisher: 'Kana',
        pageCount: 192,
        price: '6.90',
        collection: { collection: { name: 'Naruto' }, volumeFrom: volume, volumeTo: volume },
    });
}

async function read(path: string, user = owner) {
    const client = await app.authenticatedClient(user);

    return client.call<StatisticsDto>(path);
}

describe('GET /api/statistics', () => {
    it('gives an Owner the numbers of the owned books', async () => {
        const piranesi = await book('Piranesi', '9781635575637');

        await naruto(1, '9781421539898');
        await naruto(3, '9781569319000');
        await book('Emma', '9780141439587', { ownership: 'not-owned' });
        await arrange('/books/' + piranesi.id + '/reading', 'PUT', { read: true });

        const response = await read('/statistics');

        expect([response.status, response.body]).toEqual([
            200,
            {
                ownedBooks: 3,
                singleBooks: 1,
                categories: { books: 1, manga: 2, comics: 0 },
                reading: { read: 1, notRead: 2 },
                pages: { total: 656, known: 3 },
                price: { totalCents: 3070, known: 3 },
                publishers: {
                    byBooks: [
                        { name: 'Kana', books: 2, pages: 384 },
                        { name: 'Bloomsbury', books: 1, pages: 272 },
                    ],
                    byPages: [
                        { name: 'Kana', books: 2, pages: 384 },
                        { name: 'Bloomsbury', books: 1, pages: 272 },
                    ],
                    without: 0,
                    count: 2,
                },
                authors: [{ name: 'Susanna Clarke', books: 3 }],
                records: {
                    longest: {
                        id: piranesi.id,
                        title: 'Piranesi',
                        authors: ['Susanna Clarke'],
                        value: 272,
                    },
                    mostExpensive: {
                        id: piranesi.id,
                        title: 'Piranesi',
                        authors: ['Susanna Clarke'],
                        value: 1690,
                    },
                    biggestCollection: {
                        id: expect.any(String),
                        name: 'Naruto',
                        ownedBooks: 2,
                    },
                },
                collections: { finished: 0, unfinished: 1, missingVolumes: 1 },
            },
        ]);
    });
    it('gives a Guest the numbers without any reading', async () => {
        await book('Piranesi', '9781635575637');

        const response = await read('/statistics', guest);

        expect([response.status, response.body.ownedBooks, response.body.reading]).toEqual([
            200,
            1,
            null,
        ]);
    });
    it('narrows the numbers to the chosen category', async () => {
        await book('Piranesi', '9781635575637');
        await naruto(1, '9781421539898');

        const response = await read('/statistics?category=manga');

        expect(response.body).toMatchObject({
            ownedBooks: 1,
            categories: { books: 1, manga: 1, comics: 0 },
            pages: { total: 192, known: 1 },
            collections: { finished: 0, unfinished: 1, missingVolumes: 0 },
        });
    });
    it('refuses an unknown category', async () => {
        const response = await read('/statistics?category=novels');

        expect(response.status).toBe(400);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        const response = await client.call('/statistics');

        expect(response.status).toBe(401);
    });
});
