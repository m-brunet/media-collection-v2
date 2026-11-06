import type {
    BookDto,
    BookLookupDto,
} from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { BookInputFixture } from '../../../../../../../../tests/api/fixtures/book-input.fixture.js';

let app: TestApp;
const owner = new UserFixture({ username: 'camille', role: 'owner' });
const guest = new UserFixture({ username: 'morgan', role: 'guest' });
const isbn = '9782253164692';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const coverAddress = 'https://covers.openlibrary.org/b/id/11376002-L.jpg';

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([owner, guest]);
});
afterEach(async () => {
    await app?.teardown();
});

function sources() {
    return app.dependencies.books.lookup;
}

// Looks the ISBN up as an Owner, to obtain a cover token.
async function lookedUp(): Promise<Extract<BookLookupDto, { kind: 'looked-up' }>> {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

    if (response.status !== 200 || response.body.kind !== 'looked-up') {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

describe('POST /api/books/lookups', () => {
    it('opens a book already in the library without asking any source (example 11)', async () => {
        const client = await app.authenticatedClient(owner);
        const saved = (await client.call<BookDto>('/books', 'POST', BookInputFixture.of({ isbn })))
            .body;

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', {
            isbn: '2253164690',
        });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ kind: 'existing', bookId: saved.id });
        expect(sources().bnf.asked).toEqual([]);
    });

    it('combines the sources for review, the preferred one first (example 18)', async () => {
        sources().knows('bnf', isbn, {
            title: "D'un monde à l'autre",
            authors: ['Pierre Bottero'],
            publisher: 'Librairie générale française',
        });
        sources().knows('openlibrary', isbn, { publisher: 'Le livre de poche', pageCount: 257 });
        sources().cover(isbn, coverAddress, jpeg);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            kind: 'looked-up',
            isbn13: isbn,
            found: true,
            fields: {
                title: [{ value: "D'un monde à l'autre", sources: ['bnf'] }],
                authors: [{ value: ['Pierre Bottero'], sources: ['bnf'] }],
                publisher: [
                    { value: 'Librairie générale française', sources: ['bnf'] },
                    { value: 'Le livre de poche', sources: ['openlibrary'] },
                ],
                pageCount: [{ value: 257, sources: ['openlibrary'] }],
            },
            covers: [
                { token: expect.any(String), width: 400, height: 600, sources: ['openlibrary'] },
            ],
            unavailable: [],
        });
        expect(JSON.stringify(response.body)).not.toContain(coverAddress);
    });

    it('says no source knows the ISBN (example 13)', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ kind: 'looked-up', found: false, unavailable: [] });
    });

    it('names a source that could not answer (example 20)', async () => {
        sources().bnf.answer(isbn, 'fail');
        sources().knows('openlibrary', isbn, { title: "La quête d'Ewilan" });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            found: true,
            unavailable: [{ source: 'bnf', reason: 'failed' }],
        });
    });

    it('rejects an invalid ISBN', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/lookups', 'POST', { isbn: '9782253164691' });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('isbn-invalid');
    });

    it('rejects a request without an ISBN', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/lookups', 'POST', {});

        expect(response.status).toBe(400);
    });

    it('refuses a Guest', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books/lookups', 'POST', { isbn });

        expect(response.status).toBe(403);
        expect(sources().bnf.asked).toEqual([]);
    });

    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/books/lookups', 'POST', { isbn });

        expect(response.status).toBe(401);
    });
});

describe('GET /api/books/lookups/covers/:token', () => {
    it('shows a cover the lookup offered', async () => {
        sources().cover(isbn, coverAddress, jpeg);
        const { covers } = await lookedUp();
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/lookups/covers/' + covers[0]!.token);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('image/jpeg');
        expect(new Uint8Array(response.bytes)).toEqual(jpeg);
    });

    it('reports a cover the lookup did not offer', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/lookups/covers/' + crypto.randomUUID());

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('lookup-cover-missing');
    });

    it('reports a cover its source no longer provides', async () => {
        sources().cover(isbn, coverAddress, jpeg);
        const { covers } = await lookedUp();

        sources().downloader.images.clear();
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/lookups/covers/' + covers[0]!.token);

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('lookup-cover-unavailable');
    });

    it('rejects a token that is not one', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/lookups/covers/not-a-token');

        expect(response.status).toBe(400);
    });

    it('refuses a Guest', async () => {
        sources().cover(isbn, coverAddress, jpeg);
        const { covers } = await lookedUp();
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books/lookups/covers/' + covers[0]!.token);

        expect(response.status).toBe(403);
    });

    it('requires a signed-in account', async () => {
        const client = app.client();

        const response = await client.call('/books/lookups/covers/' + crypto.randomUUID());

        expect(response.status).toBe(401);
    });
});

describe('POST /api/books/lookups/covers', () => {
    it('hands back the image at a pasted web address', async () => {
        sources().webImage('https://images.example/piranesi.jpg', jpeg);
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/lookups/covers', 'POST', {
            address: 'https://images.example/piranesi.jpg',
        });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('image/jpeg');
        expect(response.headers['cache-control']).toBe('no-store');
        expect(new Uint8Array(response.bytes)).toEqual(jpeg);
    });

    it('reports an address without an image', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/lookups/covers', 'POST', {
            address: 'https://images.example/page.html',
        });

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('cover-address-unavailable');
    });

    it('rejects something that is not a web address', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/lookups/covers', 'POST', {
            address: 'file:///etc/hosts',
        });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('cover-address-invalid');
    });

    it('never fetches an address inside the home network', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/lookups/covers', 'POST', {
            address: 'http://127.0.0.1:34345/api/health',
        });

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('cover-address-unavailable');
    });

    it('rejects a request without an address', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/lookups/covers', 'POST', {});

        expect(response.status).toBe(400);
    });

    it('refuses a Guest', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books/lookups/covers', 'POST', {
            address: 'https://images.example/cover.png',
        });

        expect(response.status).toBe(403);
    });

    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/books/lookups/covers', 'POST', {
            address: 'https://images.example/cover.png',
        });

        expect(response.status).toBe(401);
    });
});
