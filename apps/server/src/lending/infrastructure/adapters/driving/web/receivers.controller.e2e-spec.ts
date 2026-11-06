import type {
    BookDto,
    LendingDto,
    ReceiverDto,
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

// Lends a new book to a receiver as an Owner, which is how receivers come to exist.
async function receiver(name: string) {
    const client = await app.authenticatedClient(owner);
    const saved = await client.call<BookDto>(
        '/books',
        'POST',
        BookInputFixture.of({ title: 'For ' + name, isbn: null, noIsbn: true }),
    );
    const response = await client.call<LendingDto>('/loans', 'POST', {
        receiver: { name },
        bookIds: [saved.body.id],
    });

    if (saved.status !== 201 || response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body.receiver;
}

describe('GET /api/receivers', () => {
    it('suggests receivers whose name contains the search, ignoring case and accents', async () => {
        const zoe = await receiver('Zoé Martin');

        await receiver('Sam Taylor');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ReceiverDto[]>('/receivers?search=ZOE');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([zoe]);
    });
    it('suggests nothing without a search', async () => {
        await receiver('Sam Taylor');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ReceiverDto[]>('/receivers');

        expect(response.body).toEqual([]);
    });
    it('lets a Guest see receiver names', async () => {
        await receiver('Sam Taylor');
        const client = await app.authenticatedClient(guest);

        const response = await client.call<ReceiverDto[]>('/receivers?search=sam');

        expect(response.body.map((value) => value.name)).toEqual(['Sam Taylor']);
    });
    it('refuses an unknown parameter', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/receivers?name=sam');

        expect(response.status).toBe(400);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        const response = await client.call('/receivers?search=sam');

        expect(response.status).toBe(401);
    });
});
