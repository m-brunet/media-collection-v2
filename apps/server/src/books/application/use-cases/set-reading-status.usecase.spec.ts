import { describe, expect, it } from 'vitest';
import { BookDoubles, guest, otherOwner, owner } from '../testing/book-doubles.test-support.js';
import { SetReadingStatus } from './set-reading-status.usecase.js';

describe('SetReadingStatus', () => {
    it('marks the book read for the signed-in account', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = await new SetReadingStatus(
            current.readings,
            current.loader,
            current.operations,
        ).execute(owner, book.id, true);

        expect(result).toEqual({ read: true });
        expect(await current.readings.isRead(owner.id, book.id)).toBe(true);
    });
    it('does not change another account status', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        await new SetReadingStatus(current.readings, current.loader, current.operations).execute(
            owner,
            book.id,
            true,
        );

        expect(await current.readings.isRead(otherOwner.id, book.id)).toBe(false);
    });
    it('records the change as a personal audit entry', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        await new SetReadingStatus(current.readings, current.loader, current.operations).execute(
            owner,
            book.id,
            true,
        );

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.reading-status-changed',
            before: { read: false },
            after: { read: true },
        });
    });
    it('refuses a Guest, who has no reading status', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = new SetReadingStatus(
            current.readings,
            current.loader,
            current.operations,
        ).execute(guest, book.id, true);

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });
});
