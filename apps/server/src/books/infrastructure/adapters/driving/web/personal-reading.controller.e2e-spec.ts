import type { BookDto } from '../../../../../../../../packages/contracts/src/http.js';
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

async function created() {
    const client = await app.authenticatedClient(owner);
    const book = (await client.call<BookDto>('/books', 'POST', BookInputFixture.of())).body;

    return { client, book };
}

describe('PUT /api/books/:id/reading', () => {
    it('changes only the signed-in account status', async () => {
        const { client, book } = await created();

        const response = await client.call('/books/' + book.id + '/reading', 'PUT', { read: true });

        expect(response.body).toEqual({ read: true });
        expect(await app.dependencies.books.readings.isRead(owner.id, book.id)).toBe(true);
        expect(await app.dependencies.books.readings.isRead(otherOwner.id, book.id)).toBe(false);
    });
    it('refuses a Guest', async () => {
        const { book } = await created();
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books/' + book.id + '/reading', 'PUT', { read: true });

        expect(response.status).toBe(403);
    });
});

describe('PUT /api/books/:id/note', () => {
    it('saves a note that only its author has', async () => {
        const { client, book } = await created();

        const response = await client.call('/books/' + book.id + '/note', 'PUT', {
            text: 'Private.',
        });

        expect(response.body).toMatchObject({ text: 'Private.' });
        expect(await app.dependencies.books.notes.find(otherOwner.id, book.id)).toBeNull();
    });
    it('never writes the note text to the audit log', async () => {
        const { client, book } = await created();

        await client.call('/books/' + book.id + '/note', 'PUT', { text: 'Very private thought.' });

        expect(JSON.stringify(await app.dependencies.audit.entries())).not.toContain(
            'Very private thought',
        );
    });
    it('refuses a Guest', async () => {
        const { book } = await created();
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books/' + book.id + '/note', 'PUT', { text: 'Note' });

        expect(response.status).toBe(403);
    });
});

describe('DELETE /api/books/:id/note', () => {
    it('deletes the note', async () => {
        const { client, book } = await created();

        await client.call('/books/' + book.id + '/note', 'PUT', { text: 'Mine.' });

        const response = await client.call('/books/' + book.id + '/note', 'DELETE');

        expect(response.status).toBe(204);
        expect(await app.dependencies.books.notes.find(owner.id, book.id)).toBeNull();
    });
});
