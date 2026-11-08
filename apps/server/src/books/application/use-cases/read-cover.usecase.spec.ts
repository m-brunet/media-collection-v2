import { describe, expect, it } from 'vitest';
import { BookDoubles, guest } from '../testing/book-doubles.test-support.js';
import { ReadCover } from './read-cover.usecase.js';

describe('ReadCover', () => {
    it('gives the cover image to any signed-in account', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);
        const file = await current.covers.store(new Uint8Array([7]), 'image/png');

        current.books.books.get(book.id)!.replaceCover(file, '2026-03-01T10:00:00.000Z');

        const result = await new ReadCover(current.covers, current.loader).execute(guest, book.id);

        expect(result).toEqual({ bytes: new Uint8Array([7]), mediaType: 'image/png' });
    });
    it('reports a book without cover', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = new ReadCover(current.covers, current.loader).execute(guest, book.id);

        await expect(result).rejects.toMatchObject({ code: 'not_found', reason: 'cover-missing' });
    });
});
