import type { BookDto } from '../../../../../../../../packages/contracts/src/http.js';
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

async function created(publisher: string, isbn: string) {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookDto>(
        '/books',
        'POST',
        BookInputFixture.of({ isbn, publisher, publisherDistinct: true }),
    );

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }
}

describe('GET /api/publishers', () => {
    it('suggests existing publishers by the start of their words, first words first', async () => {
        await created('Pika Édition', '9781635575637');
        await created('Éditions Delcourt', '9780306406157');
        await created('Kana', '9782253164692');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<string[]>('/publishers?search=edition');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(['Éditions Delcourt', 'Pika Édition']);
    });
    it('lets a Guest see the suggestions', async () => {
        await created('Glénat', '9781635575637');
        const client = await app.authenticatedClient(guest);

        const response = await client.call<string[]>('/publishers?search=gle');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(['Glénat']);
    });
    it('suggests nothing without a search', async () => {
        await created('Glénat', '9781635575637');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<string[]>('/publishers');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });
    it('refuses a search longer than 400 characters', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/publishers?search=' + 'a'.repeat(401));

        expect(response.status).toBe(400);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        const response = await client.call('/publishers?search=gle');

        expect(response.status).toBe(401);
    });
});
