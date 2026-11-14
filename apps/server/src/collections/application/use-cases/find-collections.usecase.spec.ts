import { describe, expect, it } from 'vitest';
import { CollectionDoubles } from '../testing/collection-doubles.test-support.js';
import { FindCollections } from './find-collections.usecase.js';

describe('FindCollections', () => {
    it('finds collections by partial name without case or accents', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'a1', 'owned', 'Astérix', 1);
        await CollectionDoubles.member(current, 'b1', 'owned', 'Batman', 1);

        const result = await new FindCollections(current.collections).execute('ASTER');

        expect(result).toEqual([
            { id: 'collection-1', name: 'Astérix', category: 'comics', includesVolumeZero: false },
        ]);
    });

    it('puts the collection of the exact name first', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'a1', 'owned', 'Batman', 1);
        await CollectionDoubles.member(current, 'b1', 'owned', 'Man', 1);

        const result = await new FindCollections(current.collections).execute('man');

        expect(result.map((collection) => collection.name)).toEqual(['Man', 'Batman']);
    });

    it('offers every collection for an empty search', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'a1', 'owned', 'Astérix', 1);
        await CollectionDoubles.member(current, 'b1', 'owned', 'Batman', 1);

        const result = await new FindCollections(current.collections).execute('');

        expect(result.map((collection) => collection.name)).toEqual(['Astérix', 'Batman']);
    });
});
