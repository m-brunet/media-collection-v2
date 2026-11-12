import type {
    BookBatchChangesDto,
    BookBatchDto,
    BookBatchInputDto,
    BookDto,
    NewBookDto,
} from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { BookInputFixture } from '../../../../../../../../tests/api/fixtures/book-input.fixture.js';
import { LendingArrangement } from '../../../../../../../../tests/api/fixtures/lending-arrangement.js';

let app: TestApp;
let counter = 0;
const owner = new UserFixture({ username: 'camille', role: 'owner' });
const administrator = new UserFixture({ username: 'alex', role: 'admin' });
const guest = new UserFixture({ username: 'morgan', role: 'guest' });

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([owner, administrator, guest]);
});
afterEach(async () => {
    await app?.teardown();
});

async function book(overrides: Partial<NewBookDto> = {}): Promise<BookDto> {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookDto>(
        '/books',
        'POST',
        BookInputFixture.of({
            title: 'Gunnm ' + ++counter,
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            publisher: null,
            ...overrides,
        }),
    );

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

function volume(number: number, overrides: Partial<NewBookDto> = {}): Promise<BookDto> {
    return book({
        collection: { collection: { name: 'Gunnm' }, volumeFrom: number, volumeTo: number },
        ...overrides,
    });
}

function batch(books: BookDto[], changes: BookBatchChangesDto, preview = false): BookBatchInputDto {
    return {
        collectionId: books[0]!.collection!.id,
        bookIds: books.map((chosen) => chosen.id),
        preview,
        changes,
    };
}

async function stored(chosen: BookDto) {
    const { details } = (await app.dependencies.books.books.findById(chosen.id))!;

    return {
        category: details.category,
        ownership: details.ownership,
        publisher: details.publisher,
        priceCents: details.price?.cents ?? null,
    };
}

describe('POST /api/books/batch-edit', () => {
    it('previews the changes of each book without saving them', async () => {
        const first = await volume(1, { title: 'Gunnm, the first', category: 'manga' });
        const second = await volume(2, { title: 'Gunnm, the second', category: 'manga' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookBatchDto>(
            '/books/batch-edit',
            'POST',
            batch([first, second], { publisher: 'Glénat', generatedTitles: true }, true),
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            collection: { id: first.collection!.id, name: 'Gunnm' },
            saved: false,
            books: [
                {
                    id: first.id,
                    title: 'Gunnm, the first',
                    before: { title: 'Gunnm, the first', titleGenerated: false, publisher: null },
                    after: { title: 'Gunnm Vol. 1', titleGenerated: true, publisher: 'Glénat' },
                },
                {
                    id: second.id,
                    title: 'Gunnm, the second',
                    before: { title: 'Gunnm, the second', titleGenerated: false, publisher: null },
                    after: { title: 'Gunnm Vol. 2', titleGenerated: true, publisher: 'Glénat' },
                },
            ],
            skipped: [],
        });
        expect((await stored(first)).publisher).toBeNull();
    });
    it('saves the changes for an Owner', async () => {
        const first = await volume(1);
        const second = await volume(2);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookBatchDto>(
            '/books/batch-edit',
            'POST',
            batch([first, second], { category: 'comics', price: '6.90', read: true }),
        );

        expect(response.status).toBe(200);
        expect(response.body.saved).toBe(true);
        expect(await stored(first)).toMatchObject({ category: 'comics', priceCents: 690 });
        expect(await app.dependencies.books.readings.isRead(owner.id, first.id)).toBe(true);
        expect(await stored(second)).toMatchObject({ category: 'comics', priceCents: 690 });
    });
    it('saves the changes for the Admin', async () => {
        const first = await volume(1);
        const client = await app.authenticatedClient(administrator);

        const response = await client.call<BookBatchDto>(
            '/books/batch-edit',
            'POST',
            batch([first], { publisher: 'Glénat' }),
        );

        expect(response.status).toBe(200);
        expect((await stored(first)).publisher).toBe('Glénat');
    });
    it('lists a lent book set to Not owned as skipped and leaves it unchanged', async () => {
        const first = await volume(1);
        const second = await volume(2);

        await new LendingArrangement(app.dependencies).lend({ name: 'Sam Taylor' }, first);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<BookBatchDto>(
            '/books/batch-edit',
            'POST',
            batch([first, second], { ownership: 'not-owned', publisher: 'Glénat' }),
        );

        expect(response.body.skipped).toEqual([
            { id: first.id, title: first.title, reason: 'book-lent' },
        ]);
        expect(await stored(first)).toMatchObject({ ownership: 'owned', publisher: null });
        expect(await stored(second)).toMatchObject({
            ownership: 'not-owned',
            publisher: 'Glénat',
        });
    });
    it('records one batch entry with each book change as a related change', async () => {
        const first = await volume(1);
        const client = await app.authenticatedClient(owner);

        await client.call('/books/batch-edit', 'POST', batch([first], { publisher: 'Glénat' }));

        const entries = await app.dependencies.audit.entries();
        const operation = entries.find(
            (entry) => entry.category === 'collection.books-batch-edited',
        )!.operationId;

        expect(entries.filter((entry) => entry.operationId === operation)).toEqual([
            expect.objectContaining({
                category: 'collection.books-batch-edited',
                outcome: 'successful',
                actorId: owner.id,
                subjectType: 'collection',
                subjectId: first.collection!.id,
                before: { name: 'Gunnm', bookIds: [first.id] },
                after: { name: 'Gunnm', edited: [first.id], skipped: [] },
            }),
            expect.objectContaining({
                category: 'book.updated',
                subjectType: 'book',
                subjectId: first.id,
                before: { title: first.title, publisher: null },
                after: { title: first.title, publisher: 'Glénat' },
            }),
        ]);
    });
    it('refuses a Guest', async () => {
        const first = await volume(1);
        const client = await app.authenticatedClient(guest);

        const response = await client.call(
            '/books/batch-edit',
            'POST',
            batch([first], { publisher: 'Glénat' }),
        );

        expect(response.status).toBe(403);
        expect((await stored(first)).publisher).toBeNull();
    });
    it('refuses a book of another collection and changes nothing', async () => {
        const first = await volume(1);
        const foreign = await book({
            collection: { collection: { name: 'Akira' }, volumeFrom: 1, volumeTo: 1 },
        });
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books/batch-edit',
            'POST',
            batch([first, foreign], { publisher: 'Glénat' }),
        );

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({ reason: 'book-outside-collection' });
        expect((await stored(first)).publisher).toBeNull();
    });
    it('answers 404 for an unknown book', async () => {
        const first = await volume(1);
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/batch-edit', 'POST', {
            ...batch([first], { publisher: 'Glénat' }),
            bookIds: [first.id, crypto.randomUUID()],
        });

        expect(response.status).toBe(404);
    });
    it('asks about a similar author once for the batch', async () => {
        const first = await volume(1, { authors: [{ name: 'Yukito Kishiro' }] });
        const second = await volume(2, { authors: [{ name: 'Yukito Kishiro' }] });
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books/batch-edit',
            'POST',
            batch([first, second], { authors: [{ name: 'Yukito Kishir' }] }),
        );

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
            reason: 'author-similar',
            details: { name: 'Yukito Kishir' },
        });
    });
    it('rejects a book identifier that is not a UUID', async () => {
        const first = await volume(1);
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/batch-edit', 'POST', {
            ...batch([first], { publisher: 'Glénat' }),
            bookIds: ['gunnm-1'],
        });

        expect(response.status).toBe(400);
    });
    it('rejects an empty choice of books', async () => {
        const first = await volume(1);
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/batch-edit', 'POST', {
            ...batch([first], { publisher: 'Glénat' }),
            bookIds: [],
        });

        expect(response.status).toBe(400);
    });
    it('rejects a field that cannot be changed in a batch', async () => {
        const first = await volume(1);
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/batch-edit', 'POST', {
            ...batch([first], {}),
            changes: { isbn: '9782749310015' },
        });

        expect(response.status).toBe(400);
    });
    it('rejects a tag both added and removed', async () => {
        const first = await volume(1);
        const tag = crypto.randomUUID();
        const client = await app.authenticatedClient(owner);

        const response = await client.call(
            '/books/batch-edit',
            'POST',
            batch([first], { tags: { add: [tag], remove: [tag] } }),
        );

        expect(response.status).toBe(400);
    });
});
