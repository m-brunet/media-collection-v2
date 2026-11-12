import { describe, expect, it } from 'vitest';
import { CollectionDoubles } from '../testing/collection-doubles.test-support.js';
import { OwnedCollectionBooks } from './owned-collection-books.service.js';

describe('OwnedCollectionBooks', () => {
    it('lists the owned books of the collection only', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);
        await CollectionDoubles.member(current, 'omnibus', 'owned', 'Batman', 2, 3);
        await CollectionDoubles.member(current, 'twelve', 'not-owned', 'Batman', 12);
        await CollectionDoubles.member(current, 'other', 'owned', 'Tintin', 1);

        const result = await new OwnedCollectionBooks(current.loader, current.members).of(
            'collection-1',
        );

        expect(result.toSorted()).toEqual(['omnibus', 'one']);
    });

    it('refuses an unknown collection', async () => {
        const current = CollectionDoubles.shelf();

        const result = new OwnedCollectionBooks(current.loader, current.members).of('unknown');

        await expect(result).rejects.toMatchObject({
            code: 'not_found',
            reason: 'collection-missing',
        });
    });
});
