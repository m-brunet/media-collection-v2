import { describe, expect, it } from 'vitest';
import { member, shelf } from '../testing/collection-doubles.test-support.js';

async function batman() {
    const current = shelf();

    await member(current, 'five', 'owned', 'Batman', 5);
    await member(current, 'ten', 'not-owned', 'Batman', 10);
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
        });
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
                books: [expect.objectContaining({ id: 'five', volumeFrom: 5, volumeTo: 5 })],
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
