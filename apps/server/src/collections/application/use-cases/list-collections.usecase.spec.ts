import { describe, expect, it } from 'vitest';
import { member, shelf } from '../testing/collection-doubles.test-support.js';
import { ListCollections } from './list-collections.usecase.js';

function subject(current: ReturnType<typeof shelf>) {
    return new ListCollections(
        current.collections,
        current.members,
        current.search,
        current.viewer,
    );
}

const query = { search: '', direction: 'asc' as const, offset: 0, limit: 48 };

describe('ListCollections', () => {
    it('lists collections by name with whole-collection counts', async () => {
        const current = shelf();

        await member(current, 'b1', 'owned', 'Dune', 1);
        await member(current, 'a1', 'owned', 'Batman', 1, 3);
        await member(current, 'a12', 'not-owned', 'Batman', 12);

        const result = await subject(current).execute(query);

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
        const current = shelf();

        await member(current, 'b1', 'owned', 'Dune', 1);
        await member(current, 'a1', 'owned', 'Batman', 1);

        const result = await subject(current).execute({ ...query, direction: 'desc' });

        expect(result.items.map((item) => item.name)).toEqual(['Dune', 'Batman']);
    });

    it('keeps only the collections a matching book belongs to', async () => {
        const current = shelf();

        await member(current, 'b1', 'owned', 'Dune', 1);
        await member(current, 'a1', 'owned', 'Batman', 1);
        current.search.matches = ['collection-1'];

        const result = await subject(current).execute({ ...query, search: 'arrakis' });

        expect(result.items.map((item) => item.name)).toEqual(['Dune']);
    });

    it('finds nothing when no book matches', async () => {
        const current = shelf();

        await member(current, 'b1', 'owned', 'Dune', 1);

        const result = await subject(current).execute({ ...query, search: 'nothing' });

        expect(result).toEqual({ total: 0, items: [] });
    });

    it('pages the collections', async () => {
        const current = shelf();

        await member(current, 'b1', 'owned', 'Dune', 1);
        await member(current, 'a1', 'owned', 'Batman', 1);

        const result = await subject(current).execute({ ...query, offset: 1, limit: 1 });

        expect(result.total).toBe(2);
        expect(result.items.map((item) => item.name)).toEqual(['Dune']);
    });
});
