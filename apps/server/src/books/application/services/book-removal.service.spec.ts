import { describe, expect, it } from 'vitest';
import { BookDoubles } from '../testing/book-doubles.test-support.js';

describe('BookRemoval', () => {
    it('removes the book, its membership and its now unused authors', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, {
            collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
        });

        const removed = await current.removal.remove(book.id);

        expect(removed.book.id).toBe(book.id);
        expect(current.books.books.size).toBe(0);
        expect(current.authors.authors.size).toBe(0);
        expect(current.collections.memberships.has(book.id)).toBe(false);
    });

    it('refuses a book that does not exist', async () => {
        const current = BookDoubles.library();

        const operation = current.removal.remove('unknown');

        await expect(operation).rejects.toMatchObject({ reason: 'book-missing' });
    });

    it('reports the collection change the removal caused', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, {
            collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
        });

        current.collections.changes = [
            {
                category: 'collection.removed',
                subjectType: 'collection',
                subjectId: 'collection-Batman',
                before: { name: 'Batman', includesVolumeZero: false, finished: false },
                after: null,
            },
        ];

        const removed = await current.removal.remove(book.id);

        expect(removed.changes).toEqual([
            expect.objectContaining({ category: 'collection.removed' }),
        ]);
    });
});

describe('BookRemoval with loans', () => {
    it('keeps the title and ISBN of the removed book for its completed loans', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        await current.removal.remove(book.id);

        expect(current.loans.retained).toEqual([
            { id: book.id, title: 'Piranesi', isbn: '9781635575637' },
        ]);
    });
    it('keeps no ISBN for a removed book without one', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, { isbn: null, noIsbn: true });

        await current.removal.remove(book.id);

        expect(current.loans.retained).toEqual([{ id: book.id, title: 'Piranesi', isbn: null }]);
    });
    it('refuses a lent book, removing nothing', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        current.loans.lend(book.id);

        const operation = current.removal.remove(book.id);

        await expect(operation).rejects.toMatchObject({ reason: 'book-lent' });
        expect(current.books.books.has(book.id)).toBe(true);
        expect(current.loans.retained).toEqual([]);
    });
});
