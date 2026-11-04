import { describe, expect, it } from 'vitest';
import { library, otherOwner, owner, saved } from '../testing/book-doubles.test-support.js';
import { DeletePersonalNote } from './delete-personal-note.usecase.js';

describe('DeletePersonalNote', () => {
    it('deletes the signed-in account note and keeps the book', async () => {
        const current = library();
        const book = await saved(current);

        await current.notes.save(owner.id, book.id, 'Mine.', '2026-03-01T10:00:00.000Z');

        await new DeletePersonalNote(current.notes, current.loader, current.operations).execute(
            owner,
            book.id,
        );

        expect(await current.notes.find(owner.id, book.id)).toBeNull();
        expect(current.books.books.size).toBe(1);
    });
    it('leaves another account note untouched', async () => {
        const current = library();
        const book = await saved(current);

        await current.notes.save(otherOwner.id, book.id, 'Theirs.', '2026-03-01T10:00:00.000Z');

        await new DeletePersonalNote(current.notes, current.loader, current.operations).execute(
            owner,
            book.id,
        );

        expect((await current.notes.find(otherOwner.id, book.id))!.text).toBe('Theirs.');
    });
});
