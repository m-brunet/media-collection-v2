import type {
    ActivityPageDto,
    BookcaseDto,
    BookDto,
    ShelfDto,
    TagDto,
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

function book(title: string, isbn: string) {
    return arrange<BookDto>('/books', 'POST', BookInputFixture.of({ title, isbn }));
}

function tag(name: string) {
    return arrange<TagDto>('/tags', 'POST', { name });
}

describe('GET /api/activity', () => {
    it('shows a lending of two books as one entry naming the receiver', async () => {
        const dune = await book('Dune', '9780441172719');
        const emma = await book('Emma', '9780141439587');

        await arrange('/loans', 'POST', {
            receiver: { name: 'Sam' },
            bookIds: [dune.id, emma.id],
        });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<ActivityPageDto>('/activity');

        expect(response.status).toBe(200);
        expect(response.body.entries[0]).toMatchObject({
            actor: 'camille',
            event: { kind: 'books-lent', receiver: 'Sam', titles: ['Dune', 'Emma'] },
            also: [{ kind: 'receiver-created', name: 'Sam' }],
        });
        expect(response.body.entries).toHaveLength(3);
    });
    it('tells a book placed on a shelf from a book given other tags', async () => {
        const dune = await book('Dune', '9780441172719');
        const bookcase = await arrange<BookcaseDto>('/bookcases', 'POST', { name: 'Oak' });
        const shelf = await arrange<ShelfDto>('/bookcases/' + bookcase.id + '/shelves', 'POST', {
            name: 'Top',
        });

        await arrange('/books/' + dune.id + '/organisation', 'PATCH', { shelfId: shelf.id });
        await arrange('/books/' + dune.id + '/organisation', 'PATCH', {
            tags: [{ name: 'Fantasy' }],
        });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ActivityPageDto>('/activity');

        expect(response.body.entries.slice(0, 2)).toMatchObject([
            {
                event: { kind: 'book-retagged', title: 'Dune' },
                also: [{ kind: 'tag-created', name: 'Fantasy' }],
            },
            { event: { kind: 'book-relocated', title: 'Dune' }, also: [] },
        ]);
    });
    it('lists entries newest first with their time', async () => {
        await tag('Fantasy');
        await book('Dune', '9780441172719');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ActivityPageDto>('/activity');

        expect(response.body).toEqual({
            entries: [
                expect.objectContaining({
                    occurredAt: '2026-01-01T00:00:02.000Z',
                    event: { kind: 'book-added', title: 'Dune' },
                }),
                expect.objectContaining({
                    occurredAt: '2026-01-01T00:00:01.000Z',
                    event: { kind: 'tag-created', name: 'Fantasy' },
                }),
            ],
            older: null,
        });
    });
    it('leaves out a failed change', async () => {
        await tag('Fantasy');
        const client = await app.authenticatedClient(owner);

        await client.call('/tags', 'POST', { name: 'fantasy' });

        const response = await client.call<ActivityPageDto>('/activity');

        expect(response.body.entries.map((entry) => entry.event)).toEqual([
            { kind: 'tag-created', name: 'Fantasy' },
        ]);
    });
    it('leaves out personal reading status and note changes', async () => {
        const dune = await book('Dune', '9780441172719');

        await arrange('/books/' + dune.id + '/reading', 'PUT', { read: true });
        await arrange('/books/' + dune.id + '/note', 'PUT', { text: 'Lent by my sister' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ActivityPageDto>('/activity');

        expect(response.body.entries.map((entry) => entry.event)).toEqual([
            { kind: 'book-added', title: 'Dune' },
        ]);
        expect(response.text).not.toContain('Lent by my sister');
    });
    it('leaves out account changes', async () => {
        await arrange('/account/password', 'PATCH', {
            currentPassword: owner.password,
            password: 'a-new-fixture-password',
        });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<ActivityPageDto>('/activity');

        expect(response.body).toEqual({ entries: [], older: null });
    });
    it('names the acting account by its current username', async () => {
        await tag('Fantasy');
        await arrange('/account/username', 'PATCH', {
            username: 'camille-r',
            currentPassword: owner.password,
        });
        const client = await app.authenticatedClient(guest);

        const response = await client.call<ActivityPageDto>('/activity');

        expect(response.body.entries[0]?.actor).toBe('camille-r');
    });
    it('shows twenty entries and where older ones continue', async () => {
        for (let index = 0; index < 21; index++) {
            await tag('Tag ' + String(index).padStart(2, '0'));
        }

        const client = await app.authenticatedClient(owner);

        const response = await client.call<ActivityPageDto>('/activity');

        expect(response.body.entries).toHaveLength(20);
        expect(response.body.entries.at(-1)?.event).toEqual({
            kind: 'tag-created',
            name: 'Tag 01',
        });
        expect(response.body.older).toMatch(/^2026-01-01T00:00:02\.000Z_[0-9a-f-]{36}$/);
    });
    it('continues with the older entries', async () => {
        for (let index = 0; index < 21; index++) {
            await tag('Tag ' + String(index).padStart(2, '0'));
        }

        const client = await app.authenticatedClient(owner);
        const first = await client.call<ActivityPageDto>('/activity');

        const response = await client.call<ActivityPageDto>(
            '/activity?before=' + encodeURIComponent(first.body.older!),
        );

        expect(response.body).toEqual({
            entries: [expect.objectContaining({ event: { kind: 'tag-created', name: 'Tag 00' } })],
            older: null,
        });
    });
    it('rejects an invalid cursor', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/activity?before=yesterday');

        expect(response.status).toBe(400);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        const response = await client.call('/activity');

        expect(response.status).toBe(401);
    });
});
