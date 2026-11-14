import { describe, expect, it } from 'vitest';
import { CollectionDoubles } from '../testing/collection-doubles.test-support.js';
import { CollectionTallyReader } from './collection-tally-reader.service.js';

function reader(current: ReturnType<typeof CollectionDoubles.shelf>) {
    return new CollectionTallyReader(current.collections, current.members, current.viewer);
}

describe('CollectionTallyReader', () => {
    it('counts the owned books and the missing volumes as the collections page does', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Gunnm', 1);
        await CollectionDoubles.member(current, 'two', 'owned', 'Gunnm', 2);
        await CollectionDoubles.member(current, 'five', 'not-owned', 'Gunnm', 5);

        const tallies = await reader(current).all();

        expect(tallies).toEqual([
            {
                id: 'collection-1',
                name: 'Gunnm',
                category: 'comics',
                finished: false,
                ownedBooks: 2,
                missingVolumes: 3,
            },
        ]);
    });
    it('gives the category and the finished mark of each collection', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Gunnm', 1);
        await CollectionDoubles.markCategory(current, 'collection-1', 'manga');
        await CollectionDoubles.markFinished(current, 'collection-1');

        const [tally] = await reader(current).all();

        expect([tally?.category, tally?.finished]).toEqual(['manga', true]);
    });
});
