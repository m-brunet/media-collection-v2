import { describe, expect, it } from 'vitest';
import { CollectionCoverage } from '../value-objects/collection-coverage.value-object.js';
import { VolumeRange } from '../value-objects/volume-range.value-object.js';
import type { ShoppingMember } from './collection-shopping.service.js';
import { CollectionShopping } from './collection-shopping.service.js';

function book(
    bookId: string,
    ownership: ShoppingMember['ownership'],
    from: number,
    to = from,
    category: ShoppingMember['category'] = 'comics',
): ShoppingMember {
    return {
        bookId,
        ownership,
        range: VolumeRange.of(from, to),
        title: 'Title ' + bookId,
        category,
    };
}

function shopping(members: ShoppingMember[]) {
    return CollectionShopping.of(CollectionCoverage.of(false, members), members);
}

describe('CollectionShopping', () => {
    it('lists saved Not Owned and inferred missing volumes, highest first', () => {
        const members = [book('one', 'owned', 1), book('four', 'not-owned', 4)];

        const result = shopping(members);

        expect(result.missing).toEqual([
            { volume: 4, saved: true, quickAdd: { bookId: 'four', title: 'Title four' } },
            { volume: 3, saved: false, quickAdd: null },
            { volume: 2, saved: false, quickAdd: null },
        ]);
    });

    it('takes the last Owned volume from the end of an omnibus range', () => {
        const members = [book('omnibus', 'owned', 1, 3), book('five', 'not-owned', 5)];

        const result = shopping(members);

        expect(result.lastOwned).toEqual({ volume: 3, title: null });
    });

    it('names the last Owned volume of the Books category by its title', () => {
        const members = [
            book('dune', 'owned', 1, 1, 'books'),
            book('messiah', 'owned', 2, 2, 'books'),
        ];

        const result = shopping(members);

        expect(result.lastOwned).toEqual({ volume: 2, title: 'Title messiah' });
    });

    it('has no missing volume when every expected volume is Owned', () => {
        const members = [book('one', 'owned', 1), book('two', 'owned', 2)];

        const result = shopping(members);

        expect(result).toEqual({ lastOwned: { volume: 2, title: null }, missing: [] });
    });

    it('has no last Owned volume without an Owned book', () => {
        const members = [book('three', 'not-owned', 3)];

        const result = shopping(members);

        expect(result.lastOwned).toBeNull();
        expect(result.missing.map((entry) => entry.volume)).toEqual([3, 2, 1]);
    });

    it('counts a volume Owned twice only once', () => {
        const members = [
            book('paperback', 'owned', 1),
            book('hardcover', 'owned', 1),
            book('three', 'not-owned', 3),
        ];

        const result = shopping(members);

        expect(result.missing.map((entry) => entry.volume)).toEqual([3, 2]);
    });

    it('offers no quick add for a Not Owned omnibus', () => {
        const members = [book('one', 'owned', 1), book('omnibus', 'not-owned', 2, 3)];

        const result = shopping(members);

        expect(result.missing).toEqual([
            { volume: 3, saved: true, quickAdd: null },
            { volume: 2, saved: true, quickAdd: null },
        ]);
    });

    it('offers no quick add when two Not Owned records cover the volume', () => {
        const members = [book('first', 'not-owned', 1), book('second', 'not-owned', 1)];

        const result = shopping(members);

        expect(result.missing).toEqual([{ volume: 1, saved: true, quickAdd: null }]);
    });
});
