import type { AuthorDto, BookDto } from '../../../../../../../../packages/contracts/src/http.js';
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

async function created(name: string, isbn = '9781635575637') {
    const client = await app.authenticatedClient(owner);

    return (
        await client.call<BookDto>(
            '/books',
            'POST',
            BookInputFixture.of({ isbn, authors: [{ name, distinct: true }] }),
        )
    ).body;
}

describe('GET /api/authors', () => {
    it('suggests existing authors', async () => {
        await created('Hervé Bazin');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<AuthorDto[]>('/authors?search=baz');

        expect(response.body).toEqual([{ id: expect.any(String), name: 'Hervé Bazin' }]);
    });
});

describe('PUT /api/authors/:id', () => {
    it('corrects the spelling on every linked book', async () => {
        const book = await created('Susana Clarke');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<AuthorDto>('/authors/' + book.authors[0]!.id, 'PUT', {
            name: 'Susanna Clarke',
        });

        expect(response.body).toEqual({ id: book.authors[0]!.id, name: 'Susanna Clarke' });
        expect((await app.dependencies.books.catalog.authorsOf(book.id))[0]!.name).toBe(
            'Susanna Clarke',
        );
    });
    it('refuses a name equivalent to another author', async () => {
        const book = await created('Susana Clarke');

        await created('Susanna Clarke', '9780306406157');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/authors/' + book.authors[0]!.id, 'PUT', {
            name: 'SUSANNA CLARKE',
        });

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('author-name-taken');
    });
    it('refuses a Guest', async () => {
        const book = await created('Susana Clarke');
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/authors/' + book.authors[0]!.id, 'PUT', {
            name: 'Someone',
        });

        expect(response.status).toBe(403);
    });
});
