import { describe, expect, it } from 'vitest';
import { BookDoubles, guest, otherOwner, owner } from '../testing/book-doubles.test-support.js';
import { SavePersonalNote } from './save-personal-note.usecase.js';

function subject(current: ReturnType<typeof BookDoubles.library>) {
    return new SavePersonalNote(current.notes, current.loader, current.clock, current.operations);
}

describe('SavePersonalNote', () => {
    it('saves the signed-in account note', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = await subject(current).execute(owner, book.id, ' A favourite. ');

        expect(result).toEqual({ text: 'A favourite.', updatedAt: '2026-03-01T10:00:00.000Z' });
    });
    it('keeps notes of two accounts separate', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        await subject(current).execute(owner, book.id, 'Mine.');

        await subject(current).execute(otherOwner, book.id, 'Theirs.');

        expect((await current.notes.find(owner.id, book.id))!.text).toBe('Mine.');
    });
    it('never records the note text in the audit', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        await subject(current).execute(owner, book.id, 'Very private thought.');

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.note-changed',
            after: { hasNote: true },
        });
        expect(JSON.stringify(current.trail.entries)).not.toContain('Very private thought');
    });
    it('rejects an empty note', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = subject(current).execute(owner, book.id, '   ');

        await expect(result).rejects.toMatchObject({ reason: 'note-invalid' });
    });
    it('refuses a Guest, who has no notes', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = subject(current).execute(guest, book.id, 'Note');

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });
});
