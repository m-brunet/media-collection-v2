import { describe, expect, it } from 'vitest';
import {
    BookDoubles,
    guest,
    MemoryCollectionBooks,
    otherOwner,
    owner,
} from '../testing/book-doubles.test-support.js';
import { SetCollectionReading } from './set-collection-reading.usecase.js';

function setUp(owned: string[]) {
    const current = BookDoubles.library();
    const collections = new MemoryCollectionBooks();

    collections.owned.set('batman', owned);

    return {
        current,
        useCase: new SetCollectionReading(collections, current.readings, current.operations),
    };
}

describe('SetCollectionReading', () => {
    it('marks every owned book read for the signed-in account', async () => {
        const { current, useCase } = setUp(['one', 'two']);

        await current.readings.set(owner.id, 'one', true);

        const result = await useCase.execute(owner, 'batman', true);

        expect(result).toEqual({ read: true, ownedCount: 2 });
        expect(await current.readings.isRead(owner.id, 'one')).toBe(true);
        expect(await current.readings.isRead(owner.id, 'two')).toBe(true);
    });
    it('marks every owned book not read for the signed-in account', async () => {
        const { current, useCase } = setUp(['one', 'two']);

        await current.readings.set(owner.id, 'one', true);
        await current.readings.set(owner.id, 'two', true);

        const result = await useCase.execute(owner, 'batman', false);

        expect(result).toEqual({ read: false, ownedCount: 2 });
        expect(await current.readings.isRead(owner.id, 'one')).toBe(false);
        expect(await current.readings.isRead(owner.id, 'two')).toBe(false);
    });
    it('does not change another account status', async () => {
        const { current, useCase } = setUp(['one']);

        await useCase.execute(owner, 'batman', true);

        expect(await current.readings.isRead(otherOwner.id, 'one')).toBe(false);
    });
    it('records one collection entry with each changed book as a related change', async () => {
        const { current, useCase } = setUp(['one', 'two']);

        await current.readings.set(owner.id, 'one', true);

        await useCase.execute(owner, 'batman', true);

        expect(current.trail.entries).toEqual([
            expect.objectContaining({
                category: 'collection.reading-status-changed',
                outcome: 'successful',
                subjectType: 'collection',
                subjectId: 'batman',
                before: { read: false, ownedCount: 2 },
                after: { read: true, ownedCount: 2 },
            }),
            expect.objectContaining({
                category: 'book.reading-status-changed',
                subjectType: 'book',
                subjectId: 'two',
                before: { read: false },
                after: { read: true },
            }),
        ]);
    });
    it('refuses a Guest, who has no reading status', async () => {
        const { useCase } = setUp(['one']);

        const result = useCase.execute(guest, 'batman', true);

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });
    it('refuses an unknown collection', async () => {
        const { useCase } = setUp(['one']);

        const result = useCase.execute(owner, 'missing', true);

        await expect(result).rejects.toMatchObject({ code: 'not_found' });
    });
});
