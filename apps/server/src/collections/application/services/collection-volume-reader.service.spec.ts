import { describe, expect, it } from 'vitest';
import { CollectionDoubles } from '../testing/collection-doubles.test-support.js';
import { CollectionVolumeReader } from './collection-volume-reader.service.js';

describe('CollectionVolumeReader', () => {
    it('gives the collection, its members and the numbers no book covers up to a volume', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Gunnm', 1);
        await CollectionDoubles.member(current, 'two', 'owned', 'Gunnm', 2);
        await CollectionDoubles.member(current, 'five', 'not-owned', 'Gunnm', 5);
        current.members.saveBook('two', 'owned', 'Gunnm Vol. 2', { isbn: '9782344017524' });

        const result = await new CollectionVolumeReader(current.loader, current.members).of(
            'collection-1',
            7,
        );

        expect(result).toEqual({
            id: 'collection-1',
            name: 'Gunnm',
            category: 'comics',
            members: [
                { bookId: 'one', volumeFrom: 1, volumeTo: 1, isbn: null },
                { bookId: 'two', volumeFrom: 2, volumeTo: 2, isbn: '9782344017524' },
                { bookId: 'five', volumeFrom: 5, volumeTo: 5, isbn: null },
            ],
            uncovered: [3, 4, 6, 7],
        });
    });

    it('refuses an unknown collection', async () => {
        const current = CollectionDoubles.shelf();

        const result = new CollectionVolumeReader(current.loader, current.members).of('unknown', 3);

        await expect(result).rejects.toMatchObject({ reason: 'collection-missing' });
    });
});
