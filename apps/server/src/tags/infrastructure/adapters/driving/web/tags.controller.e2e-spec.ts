import type { BookDto, TagDto } from '../../../../../../../../packages/contracts/src/http.js';
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

// Creates a tag from the Tags page, as an Owner.
async function tag(name: string) {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<TagDto>('/tags', 'POST', { name });

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

// Saves a book with tags, as an Owner.
async function tagged(...tagIds: string[]) {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookDto>(
        '/books',
        'POST',
        BookInputFixture.of({ tags: tagIds.map((id) => ({ id })) }),
    );

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

describe('GET /api/tags', () => {
    it('lists tags by name with their book counts, unused ones included', async () => {
        const fantasy = await tag('Fantasy');
        const explore = await tag('To explore');

        await tagged(fantasy.id);
        const client = await app.authenticatedClient(guest);

        const response = await client.call<TagDto[]>('/tags');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            { id: fantasy.id, name: 'Fantasy', bookCount: 1 },
            { id: explore.id, name: 'To explore', bookCount: 0 },
        ]);
    });
    it('keeps the tags whose name contains the search, ignoring case and accents', async () => {
        await tag('Médiéval');
        await tag('Fantasy');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<TagDto[]>('/tags?search=EVAL');

        expect(response.body.map((value) => value.name)).toEqual(['Médiéval']);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        const response = await client.call('/tags');

        expect(response.status).toBe(401);
    });
});

describe('POST /api/tags', () => {
    it('creates an unused tag', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call<TagDto>('/tags', 'POST', { name: ' To explore ' });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ id: expect.any(String), name: 'To explore', bookCount: 0 });
        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({ category: 'tag.created', subjectId: response.body.id }),
        );
    });
    it('refuses an equivalent existing name', async () => {
        await tag('Fantasy');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/tags', 'POST', { name: ' FANTASY' });

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('tag-name-taken');
    });
    it('refuses an empty name', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/tags', 'POST', { name: '' });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('tag-name-invalid');
    });
    it('refuses a Guest', async () => {
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/tags', 'POST', { name: 'Fantasy' });

        expect(response.status).toBe(403);
        expect(response.body.reason).toBe('guest-read-only');
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/tags', 'POST', { name: 'Fantasy' });

        expect(response.status).toBe(401);
    });
});

describe('PATCH /api/tags/:id', () => {
    it('renames the tag on every book carrying it', async () => {
        const fantasy = await tag('Fantasy');
        const book = await tagged(fantasy.id);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<TagDto>('/tags/' + fantasy.id, 'PATCH', {
            name: 'High fantasy',
        });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: fantasy.id, name: 'High fantasy', bookCount: 1 });
        expect(await app.dependencies.library.tags(book.id)).toEqual(['High fantasy']);
        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'tag.renamed',
                before: { name: 'Fantasy' },
                after: { name: 'High fantasy' },
            }),
        );
    });
    it('refuses the name of another tag', async () => {
        const fantasy = await tag('Fantasy');

        await tag('Adventure');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/tags/' + fantasy.id, 'PATCH', { name: 'adventure' });

        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('tag-name-taken');
    });
    it('reports an unknown tag', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/tags/' + crypto.randomUUID(), 'PATCH', {
            name: 'Fantasy',
        });

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('tag-missing');
    });
    it('refuses a Guest', async () => {
        const fantasy = await tag('Fantasy');
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/tags/' + fantasy.id, 'PATCH', { name: 'Epic' });

        expect(response.status).toBe(403);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/tags/' + crypto.randomUUID(), 'PATCH', {
            name: 'Fantasy',
        });

        expect(response.status).toBe(401);
    });
    it('finds the tag by its id written in uppercase', async () => {
        const fantasy = await tag('Fantasy');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<TagDto>('/tags/' + fantasy.id.toUpperCase(), 'PATCH', {
            name: 'High fantasy',
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ id: fantasy.id, name: 'High fantasy' });
    });
});

describe('DELETE /api/tags/:id', () => {
    it('removes the tag from its books, keeping the books', async () => {
        const fantasy = await tag('Fantasy');
        const book = await tagged(fantasy.id);
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/tags/' + fantasy.id, 'DELETE');

        expect(response.status).toBe(204);
        expect(await app.dependencies.library.bookIds()).toEqual([book.id]);
        expect(await app.dependencies.library.tags(book.id)).toEqual([]);
        expect(await app.dependencies.audit.entries()).toContainEqual(
            expect.objectContaining({
                category: 'tag.deleted',
                before: { name: 'Fantasy', untaggedBooks: 1 },
            }),
        );
    });
    it('reports an unknown tag', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/tags/' + crypto.randomUUID(), 'DELETE');

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('tag-missing');
    });
    it('refuses a Guest', async () => {
        const fantasy = await tag('Fantasy');
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/tags/' + fantasy.id, 'DELETE');

        expect(response.status).toBe(403);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/tags/' + crypto.randomUUID(), 'DELETE');

        expect(response.status).toBe(401);
    });
});
