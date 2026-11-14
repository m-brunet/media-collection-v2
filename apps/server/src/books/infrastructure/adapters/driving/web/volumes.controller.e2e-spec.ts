import type {
    ActivityPageDto,
    BookDto,
    NewVolumeDto,
    VolumesAddedDto,
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

async function anchor(): Promise<BookDto> {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookDto>(
        '/books',
        'POST',
        BookInputFixture.of({
            title: '',
            isbn: '9782723432931',
            category: 'manga',
            publisher: 'Glénat',
            collection: { collection: { name: 'Gunnm' }, volumeFrom: 1, volumeTo: 1 },
        }),
    );

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

function volume(number: number, isbn: string, changes: Partial<NewVolumeDto> = {}): NewVolumeDto {
    return {
        volume: number,
        isbn,
        ownership: 'owned',
        title: null,
        authors: ['Yukito Kishiro'],
        publicationYear: 2001,
        pageCount: 200,
        summary: null,
        ...changes,
    };
}

describe('POST /api/books/volumes', () => {
    it('adds the volumes to the collection with the fields of the anchor', async () => {
        const first = await anchor();
        const client = await app.authenticatedClient(owner);

        const response = await client.call<VolumesAddedDto>('/books/volumes', 'POST', {
            collectionId: first.collection!.id,
            anchorBookId: first.id,
            volumes: [
                volume(2, '9782723434324'),
                volume(3, '9782723434775', { ownership: 'not-owned' }),
            ],
        });
        const second = await client.call<BookDto>('/books/' + response.body.added[0]!.bookId);

        expect(response.status).toBe(201);
        expect(response.body.added.map((added) => [added.volume, added.title])).toEqual([
            [2, 'Gunnm Vol. 2'],
            [3, 'Gunnm Vol. 3'],
        ]);
        expect(second.body).toMatchObject({
            category: 'manga',
            publisher: 'Glénat',
            isbn: '9782723434324',
            collection: { id: first.collection!.id, volumeFrom: 2, volumeTo: 2 },
        });
    });

    it('shows a single activity entry for the volumes added', async () => {
        const first = await anchor();
        const client = await app.authenticatedClient(owner);

        await client.call('/books/volumes', 'POST', {
            collectionId: first.collection!.id,
            anchorBookId: first.id,
            volumes: [volume(2, '9782723434324'), volume(3, '9782723434775')],
        });
        const response = await client.call<ActivityPageDto>('/activity');

        expect(response.body.entries.map((entry) => entry.event.kind).sort()).toEqual([
            'book-added',
            'volumes-added',
        ]);
        expect(response.body.entries.map((entry) => entry.event)).toContainEqual({
            kind: 'volumes-added',
            name: 'Gunnm',
            count: 2,
        });
    });

    it('reports a volume left out and saves the others', async () => {
        const first = await anchor();
        const client = await app.authenticatedClient(owner);

        const response = await client.call<VolumesAddedDto>('/books/volumes', 'POST', {
            collectionId: first.collection!.id,
            anchorBookId: first.id,
            volumes: [volume(1, '9782723434324'), volume(2, '9782723434775')],
        });

        expect(response.status).toBe(201);
        expect(response.body.skipped).toEqual([
            { volume: 1, isbn: '9782723434324', reason: 'volume-taken' },
        ]);
        expect(response.body.added.map((added) => added.volume)).toEqual([2]);
    });

    it('refuses a Guest', async () => {
        const first = await anchor();
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/books/volumes', 'POST', {
            collectionId: first.collection!.id,
            anchorBookId: first.id,
            volumes: [volume(2, '9782723434324')],
        });

        expect(response.status).toBe(403);
    });

    it('refuses an empty list of volumes', async () => {
        const first = await anchor();
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/volumes', 'POST', {
            collectionId: first.collection!.id,
            anchorBookId: first.id,
            volumes: [],
        });

        expect(response.status).toBe(400);
    });

    it('refuses an invalid ISBN', async () => {
        const first = await anchor();
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/books/volumes', 'POST', {
            collectionId: first.collection!.id,
            anchorBookId: first.id,
            volumes: [volume(2, '123')],
        });

        expect(response.status).toBe(400);
    });
});
