import type {
    BookDto,
    BookLookupDto,
    VolumeCoverDto,
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
const inventaireAddress =
    'https://inventaire.io/img/entities/637042f24123f713ca64b13732771b5febb67a43';

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
            pending: [],
        });
        expect(JSON.stringify(response.body)).not.toContain(coverAddress);
    });

    it("offers the publisher's collection after the publisher, apart from an abbreviation", async () => {
        sources().knows('bnf', isbn, {
            title: "D'un monde à l'autre",
            publisher: 'Librairie générale française',
            publisherCollection: 'Le livre de poche',
        });
        sources().knows('openlibrary', isbn, { publisher: 'LGF' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect([response.status, response.body]).toEqual([
            200,
            expect.objectContaining({
                fields: expect.objectContaining({
                    publisher: [
                        { value: 'Librairie générale française', sources: ['bnf'] },
                        { value: 'Le livre de poche', sources: ['bnf'] },
                        { value: 'LGF', sources: ['openlibrary'] },
                    ],
                }),
            }),
        ]);
    });

    it('suggests the category a source gives', async () => {
        sources().knows('bnf', isbn, { title: 'Claymore', category: 'manga' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            fields: { category: [{ value: 'manga', sources: ['bnf'] }] },
        });
    });

    it("fills in an existing author's name and tells the source's spelling", async () => {
        const client = await app.authenticatedClient(owner);

        await client.call<BookDto>(
            '/books',
            'POST',
            BookInputFixture.of({ isbn: '9781635575637', authors: [{ name: "Flipflop's" }] }),
        );
        sources().knows('bnf', isbn, { title: "Darwin's Game", authors: ['Flipsflops'] });

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            fields: { authors: [{ value: ["Flipflop's"], sources: ['bnf'] }] },
            authorSpellings: [{ name: "Flipflop's", spelling: 'Flipsflops', sources: ['bnf'] }],
        });
    });

    it('says no source knows the ISBN (example 13)', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ kind: 'looked-up', found: false, unavailable: [] });
    });

    it('adds what the Sudoc knows to a record the BnF found, the BnF first (example 29)', async () => {
        sources().knows('bnf', isbn, {
            title: "D'un monde à l'autre",
            publicationDate: { year: 2006, month: null },
        });
        sources().knows('sudoc', isbn, {
            title: "D'un monde à l'autre",
            publicationDate: { year: 2007, month: null },
            pageCount: 257,
        });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.body).toMatchObject({
            fields: {
                title: [{ value: "D'un monde à l'autre", sources: ['bnf', 'sudoc'] }],
                publicationDate: [
                    { value: { year: 2006, month: null }, sources: ['bnf'] },
                    { value: { year: 2007, month: null }, sources: ['sudoc'] },
                ],
                pageCount: [{ value: 257, sources: ['sudoc'] }],
            },
            unavailable: [],
        });
    });

    it('still asks the Sudoc when the BnF cannot answer', async () => {
        sources().bnf.answer(isbn, 'fail');
        sources().knows('sudoc', isbn, { title: 'Bitterblue' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.body).toMatchObject({
            found: true,
            fields: { title: [{ value: 'Bitterblue', sources: ['sudoc'] }] },
            unavailable: [{ source: 'bnf', reason: 'failed' }],
        });
    });

    it('keeps the other sources when the Sudoc asks to wait', async () => {
        sources().knows('bnf', isbn, { title: "D'un monde à l'autre" });
        sources().sudoc.answer(isbn, { kind: 'limited', retryAt: null });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.body).toMatchObject({
            found: true,
            fields: { title: [{ value: "D'un monde à l'autre", sources: ['bnf'] }] },
            unavailable: [{ source: 'sudoc', reason: 'limited' }],
        });
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

    it('offers the Inventaire cover before the Open Library one, each with its source', async () => {
        sources().cover(isbn, coverAddress, jpeg);
        sources().inventaireCover(isbn, inventaireAddress, jpeg);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            found: true,
            covers: [{ sources: ['inventaire'] }, { sources: ['openlibrary'] }],
        });
    });

    it('names a source whose queue is too long as busy', async () => {
        sources().bnf.answer(isbn, { kind: 'busy' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            found: false,
            unavailable: [{ source: 'bnf', reason: 'busy' }],
        });
    });

    it('answers a repeated lookup from the kept answers, without asking again', async () => {
        sources().knows('bnf', isbn, { title: "D'un monde à l'autre" });
        await lookedUp();
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            found: true,
            fields: { title: [{ value: "D'un monde à l'autre", sources: ['bnf'] }] },
            pending: [],
        });
        expect(sources().bnf.asked).toEqual([isbn]);
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

describe('POST /api/books/lookups/volume-cover', () => {
    it("gives a token for a volume's cover", async () => {
        sources().cover(isbn, coverAddress, jpeg);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<VolumeCoverDto>('/books/lookups/volume-cover', 'POST', {
            isbn,
        });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ kind: 'found', token: expect.any(String) });
    });

    it("reads a volume's cover by its token, like a looked-up cover", async () => {
        sources().cover(isbn, coverAddress, jpeg);
        const client = await app.authenticatedClient(owner);
        const found = await client.call<VolumeCoverDto>('/books/lookups/volume-cover', 'POST', {
            isbn,
        });
        const token = found.body.kind === 'found' ? found.body.token : '';

        const response = await client.call('/books/lookups/covers/' + token);

        expect(response.status).toBe(200);
    });

    it('finds nothing for a volume without a cover', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<VolumeCoverDto>('/books/lookups/volume-cover', 'POST', {
            isbn,
        });

        expect(response.body).toEqual({ kind: 'none' });
    });

    it('prefers the Inventaire cover, without asking Open Library', async () => {
        sources().inventaireCover(isbn, inventaireAddress, jpeg);
        sources().cover(isbn, coverAddress, jpeg);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<VolumeCoverDto>('/books/lookups/volume-cover', 'POST', {
            isbn,
        });

        expect([response.status, response.body.kind]).toEqual([200, 'found']);
        expect(sources().openLibraryCovers.asked).toEqual([]);
    });

    it('takes the Open Library cover when Inventaire has none', async () => {
        sources().cover(isbn, coverAddress, jpeg);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<VolumeCoverDto>('/books/lookups/volume-cover', 'POST', {
            isbn,
        });

        expect([response.status, response.body.kind]).toEqual([200, 'found']);
        expect(sources().inventaireCovers.asked).toEqual([isbn]);
    });

    it('gives no cover, and no time to ask again, when the source asked to wait', async () => {
        sources().openLibraryCovers.answer(isbn, { kind: 'limited', retryAt: null });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<VolumeCoverDto>('/books/lookups/volume-cover', 'POST', {
            isbn,
        });

        expect([response.status, response.body]).toEqual([200, { kind: 'none' }]);
    });

    it('refuses a Guest', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books/lookups/volume-cover', 'POST', { isbn });

        expect(response.status).toBe(403);
    });

    it('refuses an invalid ISBN', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/lookups/volume-cover', 'POST', { isbn: '12' });

        expect(response.status).toBe(400);
    });
});

describe('lookups of an ISBN that has a kept cover', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

    async function keptCover() {
        const client = await app.authenticatedClient(owner);
        const book = (await client.call<BookDto>('/books', 'POST', BookInputFixture.of({ isbn })))
            .body;

        await client.call('/books/' + book.id + '/cover', 'PUT', undefined, {
            raw: { bytes: png, contentType: 'image/png' },
        });
        await client.call('/books/' + book.id, 'DELETE');

        return client;
    }

    it('offers the kept cover alone, without asking Inventaire or Open Library', async () => {
        sources().inventaireCover(isbn, inventaireAddress, jpeg);
        sources().cover(isbn, coverAddress, jpeg);
        const client = await keptCover();

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.body).toMatchObject({ covers: [{ sources: ['libris'] }] });
        expect(sources().inventaireCovers.asked).toEqual([]);
        expect(sources().openLibraryCovers.asked).toEqual([]);
    });

    it('still asks the information sources', async () => {
        sources().knows('bnf', isbn, { title: "D'un monde à l'autre" });
        const client = await keptCover();

        const response = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });

        expect(response.body).toMatchObject({
            fields: { title: [{ value: "D'un monde à l'autre", sources: ['bnf'] }] },
        });
    });

    it('shows the kept cover from its stored file', async () => {
        const client = await keptCover();
        const lookup = await client.call<BookLookupDto>('/books/lookups', 'POST', { isbn });
        const token = lookup.body.kind === 'looked-up' ? lookup.body.covers[0]!.token : 'no-cover';

        const response = await client.call('/books/lookups/covers/' + token);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('image/png');
    });

    it('gives the kept cover for a volume, without asking a cover source', async () => {
        sources().inventaireCover(isbn, inventaireAddress, jpeg);
        const client = await keptCover();

        const response = await client.call<VolumeCoverDto>('/books/lookups/volume-cover', 'POST', {
            isbn,
        });

        expect(response.body.kind).toBe('found');
        expect(sources().inventaireCovers.asked).toEqual([]);
    });
});
