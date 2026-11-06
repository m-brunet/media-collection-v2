import type { BookDto } from '../../../../../../../../packages/contracts/src/http.js';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { BookInputFixture } from '../../../../../../../../tests/api/fixtures/book-input.fixture.js';

let app: TestApp;
const owner = new UserFixture({ username: 'camille', role: 'owner' });
const guest = new UserFixture({ username: 'morgan', role: 'guest' });
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([owner, guest]);
});
afterEach(async () => {
    await app?.teardown();
});

async function created() {
    const client = await app.authenticatedClient(owner);
    const book = (await client.call<BookDto>('/books', 'POST', BookInputFixture.of())).body;

    return { client, book };
}

function upload(bytes: Buffer, contentType = 'image/png') {
    return { raw: { bytes, contentType } };
}

// A 200 × 300 cover centred on a white 300 × 300 square, as online shops serve them.
async function shopThumbnail() {
    const art = await sharp({
        create: { width: 200, height: 300, channels: 3, background: { r: 40, g: 60, b: 120 } },
    })
        .png()
        .toBuffer();

    return sharp({
        create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
        .composite([{ input: art, left: 50, top: 0 }])
        .png()
        .toBuffer();
}

describe('PUT /api/books/:id/cover', () => {
    it('stores the cover image', async () => {
        const { client, book } = await created();

        const response = await client.call<BookDto>(
            '/books/' + book.id + '/cover',
            'PUT',
            undefined,
            upload(png),
        );

        expect(response.status).toBe(200);
        expect(response.body.hasCover).toBe(true);
    });
    it('stores the cover without the white bars of a shop thumbnail', async () => {
        const { client, book } = await created();
        const thumbnail = await shopThumbnail();

        const response = await client.call<BookDto>(
            '/books/' + book.id + '/cover',
            'PUT',
            undefined,
            upload(thumbnail),
        );

        const saved = await app.dependencies.books.books.findById(book.id);
        const stored = await app.dependencies.books.covers.read(saved!.snapshot.coverFile!);
        const { width, height } = await sharp(stored!.bytes).metadata();

        expect(response.status).toBe(200);
        expect({ width, height }).toEqual({ width: 200, height: 300 });
        expect(stored!.mediaType).toBe('image/png');
    });
    it('rejects a file that is not a supported image', async () => {
        const { client, book } = await created();

        const response = await client.call(
            '/books/' + book.id + '/cover',
            'PUT',
            undefined,
            upload(Buffer.from('GIF89a'), 'image/gif'),
        );

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('cover-format');
    });
    it('rejects an image above 10 MB', async () => {
        const { client, book } = await created();
        const large = Buffer.concat([png, Buffer.alloc(11 * 1024 * 1024)]);

        const response = await client.call(
            '/books/' + book.id + '/cover',
            'PUT',
            undefined,
            upload(large),
        );

        expect(response.status).toBe(413);
        expect(response.body.reason).toBe('cover-too-large');
    });
    it('refuses a Guest', async () => {
        const { book } = await created();
        const client = await app.authenticatedClient(guest);

        const response = await client.call(
            '/books/' + book.id + '/cover',
            'PUT',
            undefined,
            upload(png),
        );

        expect(response.status).toBe(403);
    });
});

describe('GET /api/books/:id/cover', () => {
    it('gives the stored image to a signed-in account', async () => {
        const { client: ownerClient, book } = await created();

        await ownerClient.call('/books/' + book.id + '/cover', 'PUT', undefined, upload(png));
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books/' + book.id + '/cover');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('image/png');
        expect(response.bytes.equals(png)).toBe(true);
    });
    it('reports a book without cover', async () => {
        const { client, book } = await created();

        const response = await client.call('/books/' + book.id + '/cover');

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('cover-missing');
    });
});

describe('DELETE /api/books/:id/cover', () => {
    it('removes the cover', async () => {
        const { client, book } = await created();

        await client.call('/books/' + book.id + '/cover', 'PUT', undefined, upload(png));

        const response = await client.call<BookDto>('/books/' + book.id + '/cover', 'DELETE');

        expect(response.body.hasCover).toBe(false);
    });
});
