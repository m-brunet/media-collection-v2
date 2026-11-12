import { describe, expect, it } from 'vitest';
import {
    BookDoubles,
    guest,
    MemoryCollectionBooks,
    otherOwner,
    owner,
} from '../testing/book-doubles.test-support.js';
import { GetCollectionReading } from './get-collection-reading.usecase.js';

function setUp(owned: string[]) {
    const current = BookDoubles.library();
    const collections = new MemoryCollectionBooks();

    collections.owned.set('batman', owned);

    return {
        current,
        useCase: new GetCollectionReading(collections, current.readings),
    };
}

describe('GetCollectionReading', () => {
    it('is read when the signed-in account has read every owned book', async () => {
        const { current, useCase } = setUp(['one', 'two']);

        await current.readings.set(owner.id, 'one', true);
        await current.readings.set(owner.id, 'two', true);

        const result = await useCase.execute(owner, 'batman');

        expect(result).toEqual({ read: true, ownedCount: 2 });
    });
    it('is not read while one owned book is unread', async () => {
        const { current, useCase } = setUp(['one', 'two']);

        await current.readings.set(owner.id, 'one', true);

        const result = await useCase.execute(owner, 'batman');

        expect(result).toEqual({ read: false, ownedCount: 2 });
    });
    it('reads only the signed-in account status', async () => {
        const { current, useCase } = setUp(['one']);

        await current.readings.set(otherOwner.id, 'one', true);

        const result = await useCase.execute(owner, 'batman');

        expect(result).toEqual({ read: false, ownedCount: 1 });
    });
    it('refuses a Guest, who has no reading status', async () => {
        const { useCase } = setUp(['one']);

        const result = useCase.execute(guest, 'batman');

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });
    it('refuses an unknown collection', async () => {
        const { useCase } = setUp(['one']);

        const result = useCase.execute(owner, 'missing');

        await expect(result).rejects.toMatchObject({ code: 'not_found' });
    });
});
