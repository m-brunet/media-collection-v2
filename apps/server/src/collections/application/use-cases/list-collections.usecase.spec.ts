import { describe, expect, it } from 'vitest';
import { BookFilter } from '../../../shared/application/book-filter.js';
import {
    anyBook,
    CollectionDoubles,
    guest,
    owner,
} from '../testing/collection-doubles.test-support.js';
import { ListCollections } from './list-collections.usecase.js';

function subject(current: ReturnType<typeof CollectionDoubles.shelf>) {
    return new ListCollections(
        current.collections,
        current.members,
        current.search,
        current.viewer,
    );
}

const query = { search: '', direction: 'asc' as const, offset: 0, limit: 48, filter: anyBook };

describe('ListCollections', () => {
    it('lists collections by name with whole-collection counts', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'b1', 'owned', 'Dune', 1);
        await CollectionDoubles.member(current, 'a1', 'owned', 'Batman', 1, 3);
        await CollectionDoubles.member(current, 'a12', 'not-owned', 'Batman', 12);

        const result = await subject(current).execute(owner, query);

        expect(result.total).toBe(2);
        expect(result.items.map((item) => item.name)).toEqual(['Batman', 'Dune']);
        expect(result.items[0]).toMatchObject({
            bookCount: 2,
            expectedCount: 12,
            ownedCount: 3,
            missingCount: 9,
            finished: false,
        });
    });

    it('orders collections from Z to A', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'b1', 'owned', 'Dune', 1);
        await CollectionDoubles.member(current, 'a1', 'owned', 'Batman', 1);

        const result = await subject(current).execute(owner, { ...query, direction: 'desc' });

        expect(result.items.map((item) => item.name)).toEqual(['Dune', 'Batman']);
    });

    it('keeps only the collections a matching book belongs to', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'b1', 'owned', 'Dune', 1);
        await CollectionDoubles.member(current, 'a1', 'owned', 'Batman', 1);
        current.search.matches = ['collection-1'];

        const result = await subject(current).execute(owner, { ...query, search: 'arrakis' });

        expect(result.items.map((item) => item.name)).toEqual(['Dune']);
    });

    it('finds nothing when no book matches', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'b1', 'owned', 'Dune', 1);

        const result = await subject(current).execute(owner, { ...query, search: 'nothing' });

        expect(result).toEqual({ total: 0, items: [] });
    });

    it('pages the collections', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'b1', 'owned', 'Dune', 1);
        await CollectionDoubles.member(current, 'a1', 'owned', 'Batman', 1);

        const result = await subject(current).execute(owner, { ...query, offset: 1, limit: 1 });

        expect(result.total).toBe(2);
        expect(result.items.map((item) => item.name)).toEqual(['Dune']);
    });

    it('searches the collections through their books with the filters', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'b1', 'owned', 'Dune', 1);
        current.search.matches = ['collection-1'];
        const filter = BookFilter.of({ ownerships: ['owned'] });

        const result = await subject(current).execute(owner, { ...query, filter });

        expect(result.items.map((item) => item.name)).toEqual(['Dune']);
        expect(current.search.calls).toEqual([{ search: '', filter, readerId: owner.id }]);
    });

    it('searches without a reader for a Guest', async () => {
        const current = CollectionDoubles.shelf();
        const filter = BookFilter.of({ categories: ['manga'] });

        await subject(current).execute(guest, { ...query, filter });

        expect(current.search.calls).toEqual([{ search: '', filter, readerId: null }]);
    });

    it('refuses a reading filter for a Guest', async () => {
        const current = CollectionDoubles.shelf();
        const filter = BookFilter.of({ reading: ['read'] });

        const result = subject(current).execute(guest, { ...query, filter });

        await expect(result).rejects.toMatchObject({ reason: 'reading-filter-unavailable' });
    });
});
