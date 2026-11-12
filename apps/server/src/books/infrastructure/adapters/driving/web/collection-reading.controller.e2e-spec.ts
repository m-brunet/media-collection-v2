import type {
    BookDto,
    CollectionReadingDto,
    MembershipDto,
    NewBookDto,
} from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { BookInputFixture } from '../../../../../../../../tests/api/fixtures/book-input.fixture.js';

let app: TestApp;
let counter = 0;
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

function membership(volume: number): MembershipDto {
    return { collection: { name: 'Batman' }, volumeFrom: volume, volumeTo: volume };
}

async function volume(number: number, overrides: Partial<NewBookDto> = {}): Promise<BookDto> {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookDto>(
        '/books',
        'POST',
        BookInputFixture.of({
            title: 'Batman ' + ++counter,
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            collection: membership(number),
            ...overrides,
        }),
    );

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

async function markRead(user: UserFixture, book: BookDto) {
    const client = await app.authenticatedClient(user);
    const response = await client.call('/books/' + book.id + '/reading', 'PUT', { read: true });

    if (response.status !== 200) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }
}

function readingOf(collectionId: string) {
    return '/collections/' + collectionId + '/reading';
}

describe('GET /api/collections/:id/reading', () => {
    it('is read once the signed-in account has read every owned book', async () => {
        const first = await volume(1);
        const second = await volume(2);

        await volume(3, { ownership: 'not-owned' });
        await markRead(owner, first);
        await markRead(owner, second);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionReadingDto>(readingOf(first.collection!.id));

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ read: true, ownedCount: 2 });
    });
    it('is not read while one owned book is unread', async () => {
        const first = await volume(1);

        await volume(2);
        await markRead(owner, first);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionReadingDto>(readingOf(first.collection!.id));

        expect(response.body).toEqual({ read: false, ownedCount: 2 });
    });
    it('ignores what another account has read', async () => {
        const first = await volume(1);

        await markRead(otherOwner, first);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionReadingDto>(readingOf(first.collection!.id));

        expect(response.body).toEqual({ read: false, ownedCount: 1 });
    });
    it('refuses a Guest', async () => {
        const first = await volume(1);
        const client = await app.authenticatedClient(guest);

        const response = await client.call(readingOf(first.collection!.id));

        expect(response.status).toBe(403);
    });
    it('answers 404 for an unknown collection', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call(readingOf(crypto.randomUUID()));

        expect(response.status).toBe(404);
    });
    it('rejects an identifier that is not a UUID', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call(readingOf('batman'));

        expect(response.status).toBe(400);
    });
});

describe('PUT /api/collections/:id/reading', () => {
    it('marks every owned book read for the signed-in account only', async () => {
        const first = await volume(1);
        const second = await volume(2);
        const wanted = await volume(3, { ownership: 'not-owned' });
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionReadingDto>(
            readingOf(first.collection!.id),
            'PUT',
            { read: true },
        );

        const readings = app.dependencies.books.readings;

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ read: true, ownedCount: 2 });
        expect(await readings.isRead(owner.id, first.id)).toBe(true);
        expect(await readings.isRead(owner.id, second.id)).toBe(true);
        expect(await readings.isRead(owner.id, wanted.id)).toBe(false);
        expect(await readings.isRead(otherOwner.id, first.id)).toBe(false);
    });
    it('marks every owned book not read', async () => {
        const first = await volume(1);
        const second = await volume(2);

        await markRead(owner, first);
        await markRead(owner, second);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<CollectionReadingDto>(
            readingOf(first.collection!.id),
            'PUT',
            { read: false },
        );

        const readings = app.dependencies.books.readings;

        expect(response.body).toEqual({ read: false, ownedCount: 2 });
        expect(await readings.isRead(owner.id, first.id)).toBe(false);
        expect(await readings.isRead(owner.id, second.id)).toBe(false);
    });
    it('records one operation for the collection and each changed book', async () => {
        const first = await volume(1);
        const second = await volume(2);

        await markRead(owner, first);
        const client = await app.authenticatedClient(owner);

        await client.call(readingOf(first.collection!.id), 'PUT', { read: true });

        const entries = await app.dependencies.audit.entries();
        const operation = entries.find(
            (entry) => entry.category === 'collection.reading-status-changed',
        )!.operationId;

        expect(entries.filter((entry) => entry.operationId === operation)).toEqual([
            expect.objectContaining({
                category: 'collection.reading-status-changed',
                outcome: 'successful',
                actorId: owner.id,
                subjectType: 'collection',
                subjectId: first.collection!.id,
                before: { read: false, ownedCount: 2 },
                after: { read: true, ownedCount: 2 },
            }),
            expect.objectContaining({
                category: 'book.reading-status-changed',
                subjectType: 'book',
                subjectId: second.id,
                before: { read: false },
                after: { read: true },
            }),
        ]);
    });
    it('refuses a Guest', async () => {
        const first = await volume(1);
        const client = await app.authenticatedClient(guest);

        const response = await client.call(readingOf(first.collection!.id), 'PUT', {
            read: true,
        });

        expect(response.status).toBe(403);
        expect(await app.dependencies.books.readings.isRead(guest.id, first.id)).toBe(false);
    });
    it('answers 404 for an unknown collection', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call(readingOf(crypto.randomUUID()), 'PUT', {
            read: true,
        });

        expect(response.status).toBe(404);
    });
    it('rejects a body without a boolean read', async () => {
        const first = await volume(1);
        const client = await app.authenticatedClient(owner);

        const response = await client.call(readingOf(first.collection!.id), 'PUT', {
            read: 'yes',
        });

        expect(response.status).toBe(400);
    });
});
