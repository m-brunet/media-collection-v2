import { describe, expect, it } from 'vitest';
import { library, saved } from '../testing/book-doubles.test-support.js';

describe('BookRemoval', () => {
    it('removes the book, its membership and its now unused authors', async () => {
        const current = library();
        const book = await saved(current, {
            collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
        });

        const removed = await current.removal.remove(book.id);

        expect(removed.id).toBe(book.id);
        expect(current.books.books.size).toBe(0);
        expect(current.authors.authors.size).toBe(0);
        expect(current.collections.memberships.has(book.id)).toBe(false);
    });

    it('refuses a book that does not exist', async () => {
        const current = library();

        const operation = current.removal.remove('unknown');

        await expect(operation).rejects.toMatchObject({ reason: 'book-missing' });
    });
});
