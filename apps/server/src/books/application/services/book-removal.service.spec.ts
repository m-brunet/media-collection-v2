import { describe, expect, it } from 'vitest';
import { library, saved } from '../testing/book-doubles.test-support.js';

describe('BookRemoval', () => {
    it('removes the book, its membership and its now unused authors', async () => {
        const current = library();
        const book = await saved(current, {
            collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
        });

        const removed = await current.removal.remove(book.id);

        expect(removed.book.id).toBe(book.id);
        expect(current.books.books.size).toBe(0);
        expect(current.authors.authors.size).toBe(0);
        expect(current.collections.memberships.has(book.id)).toBe(false);
    });

    it('refuses a book that does not exist', async () => {
        const current = library();

        const operation = current.removal.remove('unknown');

        await expect(operation).rejects.toMatchObject({ reason: 'book-missing' });
    });

    it('reports the collection change the removal caused', async () => {
        const current = library();
        const book = await saved(current, {
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
