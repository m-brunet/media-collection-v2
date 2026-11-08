import { describe, expect, it } from 'vitest';
import { CollectionDoubles } from '../testing/collection-doubles.test-support.js';

async function batman() {
    const current = CollectionDoubles.shelf();

    await CollectionDoubles.member(current, 'five', 'owned', 'Batman', 5);
    await CollectionDoubles.member(current, 'ten', 'not-owned', 'Batman', 10);
    const collection = (await current.collections.findById('collection-1'))!;
    const records = await current.members.ofCollections(['collection-1']);

    return { current, collection, records };
}

describe('CollectionViewer', () => {
    it('summarises the whole collection', async () => {
        const { current, collection, records } = await batman();

        const summary = current.viewer.summary(collection, records);

        expect(summary).toEqual({
            id: 'collection-1',
            name: 'Batman',
            includesVolumeZero: false,
            finished: false,
            bookCount: 2,
            expectedFrom: 1,
            expectedTo: 10,
            expectedCount: 10,
            ownedCount: 1,
            missingCount: 9,
            lastOwned: 5,
            previews: [],
        });
    });

    it('previews the covers of owned books first, in coverage order, then the others', async () => {
        const current = CollectionDoubles.shelf();
        const covered = (id: string, ownership: 'owned' | 'not-owned') =>
            current.members.saveBook(id, ownership, 'Batman ' + id, {
                hasCover: true,
                updatedAt: '2026-02-0' + id.length + 'T00:00:00.000Z',
            });

        await CollectionDoubles.member(current, 'one', 'not-owned', 'Batman', 1);
        await CollectionDoubles.member(current, 'two', 'owned', 'Batman', 2);
        await CollectionDoubles.member(current, 'three', 'owned', 'Batman', 3);
        await CollectionDoubles.member(current, 'four', 'owned', 'Batman', 4);
        covered('one', 'not-owned');
        covered('three', 'owned');
        covered('four', 'owned');
        const collection = (await current.collections.findById('collection-1'))!;
        const records = await current.members.ofCollections(['collection-1']);

        const summary = current.viewer.summary(collection, records);

        expect(summary.previews).toEqual([
            { id: 'three', title: 'Batman three', updatedAt: '2026-02-05T00:00:00.000Z' },
            { id: 'four', title: 'Batman four', updatedAt: '2026-02-04T00:00:00.000Z' },
        ]);
    });

    it('falls back to the covers of books not owned', async () => {
        const { current, collection } = await batman();

        current.members.saveBook('ten', 'not-owned', 'Batman ten', { hasCover: true });
        const records = await current.members.ofCollections(['collection-1']);

        const summary = current.viewer.summary(collection, records);

        expect(summary.previews.map((preview) => preview.id)).toEqual(['ten']);
    });

    it('describes each expected volume with the books covering it', async () => {
        const { current, collection, records } = await batman();

        const details = current.viewer.details(collection, records);

        expect(details.volumes).toEqual([
            { from: 1, to: 4, state: 'inferred', books: [] },
            {
                from: 5,
                to: 5,
                state: 'owned',
                books: [
                    {
                        id: 'five',
                        title: 'Book five',
                        isbn: null,
                        publisher: null,
                        category: 'comics',
                        ownership: 'owned',
                        hasCover: false,
                        updatedAt: '2026-01-01T00:00:00.000Z',
                        volumeFrom: 5,
                        volumeTo: 5,
                    },
                ],
            },
            { from: 6, to: 9, state: 'inferred', books: [] },
            {
                from: 10,
                to: 10,
                state: 'planned',
                books: [expect.objectContaining({ id: 'ten', ownership: 'not-owned' })],
            },
        ]);
    });
});
