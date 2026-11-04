import { describe, expect, it } from 'vitest';
import { guest, library, owner, saved } from '../testing/book-doubles.test-support.js';
import { DeleteBook } from './delete-book.usecase.js';

function subject(current: ReturnType<typeof library>) {
    return new DeleteBook(
        current.books,
        current.authors,
        current.covers,
        current.loader,
        current.operations,
    );
}

describe('DeleteBook', () => {
    it('deletes the book and its now unused author', async () => {
        const current = library();
        const book = await saved(current);

        await subject(current).execute(owner, book.id);

        expect(current.books.books.size).toBe(0);
        expect(current.authors.authors.size).toBe(0);
    });
    it('removes the cover file', async () => {
        const current = library();
        const book = await saved(current);
        const file = await current.covers.store(new Uint8Array([1]), 'image/png');
        const stored = current.books.books.get(book.id)!;

        stored.replaceCover(file, '2026-03-01T10:00:00.000Z');

        await subject(current).execute(owner, book.id);

        expect(current.covers.files.size).toBe(0);
    });
    it('records the deleted information', async () => {
        const current = library();
        const book = await saved(current);

        await subject(current).execute(owner, book.id);

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.deleted',
            before: expect.objectContaining({ title: 'Piranesi' }),
            after: null,
        });
    });
    it('refuses a Guest and keeps the book', async () => {
        const current = library();
        const book = await saved(current);

        const result = subject(current).execute(guest, book.id);

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.books.books.size).toBe(1);
    });
});
