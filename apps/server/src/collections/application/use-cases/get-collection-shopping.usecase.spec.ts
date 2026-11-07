import { describe, expect, it } from 'vitest';
import { guest, member, owner, shelf } from '../testing/collection-doubles.test-support.js';
import { GetCollectionShopping } from './get-collection-shopping.usecase.js';

function subject(current: ReturnType<typeof shelf>) {
    return new GetCollectionShopping(current.loader, current.members, current.viewer);
}

describe('GetCollectionShopping', () => {
    it('shows the last Owned volume and the missing ones with their quick add', async () => {
        const current = shelf();

        await member(current, 'two', 'owned', 'Batman', 2);
        await member(current, 'four', 'not-owned', 'Batman', 4);

        const result = await subject(current).execute(owner, 'collection-1');

        expect(result).toEqual({
            id: 'collection-1',
            name: 'Batman',
            finished: false,
            expectedCount: 4,
            ownedCount: 1,
            lastOwned: { volume: 2, title: null },
            missing: [
                { volume: 1, saved: false, quickAdd: null },
                { volume: 3, saved: false, quickAdd: null },
                { volume: 4, saved: true, quickAdd: { bookId: 'four', title: 'Book four' } },
            ],
        });
    });

    it('refuses an unknown collection', async () => {
        const current = shelf();

        const operation = subject(current).execute(owner, 'unknown');

        await expect(operation).rejects.toMatchObject({ code: 'not_found' });
    });

    it('refuses a Guest', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);

        const operation = subject(current).execute(guest, 'collection-1');

        await expect(operation).rejects.toMatchObject({ code: 'forbidden' });
    });
});
