import { describe, expect, it } from 'vitest';
import { BookDoubles, guest, owner } from '../testing/book-doubles.test-support.js';
import { RemoveCover } from './remove-cover.usecase.js';

async function withCover() {
    const current = BookDoubles.library();
    const book = await BookDoubles.saved(current);
    const file = await current.covers.store(new Uint8Array([1]), 'image/png');

    current.books.books.get(book.id)!.replaceCover(file, '2026-03-01T10:00:00.000Z');

    return { current, book };
}

function subject(current: ReturnType<typeof BookDoubles.library>) {
    return new RemoveCover(
        current.books,
        current.covers,
        current.loader,
        current.viewer,
        current.clock,
        current.operations,
    );
}

describe('RemoveCover', () => {
    it('removes the cover so the fallback is shown', async () => {
        const { current, book } = await withCover();

        const result = await subject(current).execute(owner, book.id);

        expect(result.hasCover).toBe(false);
        expect(current.covers.files.size).toBe(0);
    });
    it('records the change with the book title', async () => {
        const { current, book } = await withCover();

        await subject(current).execute(owner, book.id);

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.cover-changed',
            subjectId: book.id,
            before: { title: book.title, hasCover: true },
            after: { title: book.title, hasCover: false },
        });
    });
    it('refuses a Guest and keeps the cover', async () => {
        const { current, book } = await withCover();

        const result = subject(current).execute(guest, book.id);

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.covers.files.size).toBe(1);
    });
});
