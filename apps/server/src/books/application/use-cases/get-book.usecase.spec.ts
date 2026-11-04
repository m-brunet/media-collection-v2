import { describe, expect, it } from 'vitest';
import { guest, library, otherOwner, owner, saved } from '../testing/book-doubles.test-support.js';
import { GetBook } from './get-book.usecase.js';

describe('GetBook', () => {
    it('shows the shared information with the viewer reading status and note', async () => {
        const current = library();
        const book = await saved(current, {}, true);

        await current.notes.save(owner.id, book.id, 'A favourite.', '2026-03-01T10:00:00.000Z');

        const result = await new GetBook(current.loader, current.viewer).execute(owner, book.id);

        expect(result.personal).toEqual({
            read: true,
            note: { text: 'A favourite.', updatedAt: '2026-03-01T10:00:00.000Z' },
        });
    });
    it('never shows another account its note or reading status', async () => {
        const current = library();
        const book = await saved(current, {}, true);

        await current.notes.save(owner.id, book.id, 'Private.', '2026-03-01T10:00:00.000Z');

        const result = await new GetBook(current.loader, current.viewer).execute(
            otherOwner,
            book.id,
        );

        expect(result.personal).toEqual({ read: false, note: null });
    });
    it('gives a Guest no personal reading information', async () => {
        const current = library();
        const book = await saved(current, {}, true);

        const result = await new GetBook(current.loader, current.viewer).execute(guest, book.id);

        expect(result.personal).toBeNull();
        expect(result.title).toBe('Piranesi');
    });
    it('reports a missing book', async () => {
        const current = library();

        const result = new GetBook(current.loader, current.viewer).execute(owner, 'missing');

        await expect(result).rejects.toMatchObject({ code: 'not_found' });
    });
});
