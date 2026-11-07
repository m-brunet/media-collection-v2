import { describe, expect, it } from 'vitest';
import {
    guest,
    markFinished,
    member,
    owner,
    shelf,
} from '../testing/collection-doubles.test-support.js';
import { ListShoppingCollections } from './list-shopping-collections.usecase.js';

function subject(current: ReturnType<typeof shelf>) {
    return new ListShoppingCollections(current.collections, current.members, current.viewer);
}

describe('ListShoppingCollections', () => {
    it('lists unfinished collections by name with their counts', async () => {
        const current = shelf();

        await member(current, 'tintin-8', 'owned', 'Tintin', 8);
        await member(current, 'batman-4', 'owned', 'Batman', 4);
        await member(current, 'batman-12', 'not-owned', 'Batman', 12);

        const result = await subject(current).execute(owner);

        expect(result).toEqual([
            {
                id: 'collection-2',
                name: 'Batman',
                expectedCount: 12,
                ownedCount: 1,
                missingCount: 11,
                lastOwned: 4,
            },
            {
                id: 'collection-1',
                name: 'Tintin',
                expectedCount: 8,
                ownedCount: 1,
                missingCount: 7,
                lastOwned: 8,
            },
        ]);
    });

    it('keeps an unfinished collection without known gaps', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'The Hunger Games', 1);

        const result = await subject(current).execute(owner);

        expect(result).toMatchObject([{ name: 'The Hunger Games', missingCount: 0, lastOwned: 1 }]);
    });

    it('hides Finished collections', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Dune', 1);
        await markFinished(current, 'collection-1');

        const result = await subject(current).execute(owner);

        expect(result).toEqual([]);
    });

    it('refuses a Guest', async () => {
        const current = shelf();

        const operation = subject(current).execute(guest);

        await expect(operation).rejects.toMatchObject({ code: 'forbidden' });
    });
});
