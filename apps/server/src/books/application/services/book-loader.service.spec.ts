import { describe, expect, it } from 'vitest';
import { BookDoubles } from '../testing/book-doubles.test-support.js';

describe('BookLoader', () => {
    it('loads a saved book', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = await current.loader.load(book.id);

        expect(result.id).toBe(book.id);
    });
    it('reports a missing book', async () => {
        const current = BookDoubles.library();

        const result = current.loader.load('missing');

        await expect(result).rejects.toMatchObject({ code: 'not_found', reason: 'book-missing' });
    });
});
