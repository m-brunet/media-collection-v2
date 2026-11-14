import type {
    BookDto,
    MissingVolumesDto,
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

async function volume(number: number, isbn: string): Promise<BookDto> {
    const client = await app.authenticatedClient(owner);
    const response = await client.call<BookDto>(
        '/books',
        'POST',
        BookInputFixture.of({
            title: '',
            isbn,
            category: 'manga',
            collection: {
                collection: { name: 'Gunnm' },
                volumeFrom: number,
                volumeTo: number,
            },
        }),
    );

    if (response.status !== 201) {
        throw new Error('Arranging the scenario failed: ' + response.text);
    }

    return response.body;
}

function search(collectionId: string) {
    return '/collections/' + collectionId + '/missing-volumes/search';
}

describe('POST /api/collections/:id/missing-volumes/search', () => {
    it("finds the collection's missing volumes from the edition of an owned volume", async () => {
        const first = await volume(1, '9782723432931');

        await volume(3, '9782723434775');
        const lookup = app.dependencies.books.lookup;

        lookup.volume('9782723434775', 'Gunnm', 3);
        lookup.volume('9782723434324', 'Gunnm', 2);
        lookup.volume('9782723434782', 'Gunnm', 4);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<MissingVolumesDto>(
            search(first.collection!.id),
            'POST',
            { upTo: 5 },
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            kind: 'found',
            collection: { id: first.collection!.id, name: 'Gunnm', category: 'manga' },
            anchor: { volume: 3 },
            series: 'Gunnm',
            rows: [
                {
                    volume: 2,
                    generatedTitle: 'Gunnm Vol. 2',
                    editions: [{ isbn13: '9782723434324', inLibrary: false }],
                },
                { volume: 4, editions: [{ isbn13: '9782723434782' }] },
                { volume: 5, editions: [] },
            ],
        });
    });

    it('says the edition is not in the catalogue', async () => {
        const first = await volume(1, '9782723432931');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<MissingVolumesDto>(
            search(first.collection!.id),
            'POST',
            { upTo: 5 },
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ kind: 'edition-not-found' });
    });

    it('refuses a Guest', async () => {
        const first = await volume(1, '9782723432931');
        const client = await app.authenticatedClient(guest);

        const response = await client.call(search(first.collection!.id), 'POST', { upTo: 5 });

        expect(response.status).toBe(403);
    });

    it('refuses a volume that is not a whole number', async () => {
        const first = await volume(1, '9782723432931');
        const client = await app.authenticatedClient(owner);

        const response = await client.call(search(first.collection!.id), 'POST', { upTo: 2.5 });

        expect(response.status).toBe(400);
    });

    it('refuses more than 200 volumes at once', async () => {
        const first = await volume(1, '9782723432931');
        const client = await app.authenticatedClient(owner);

        const response = await client.call(search(first.collection!.id), 'POST', {
            upTo: 300,
        });

        expect(response.status).toBe(400);
    });

    it('refuses an unknown collection', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call(search('00000000-0000-4000-8000-000000000000'), 'POST', {
            upTo: 5,
        });

        expect(response.status).toBe(404);
    });
});
