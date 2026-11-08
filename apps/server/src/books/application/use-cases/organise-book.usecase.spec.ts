import { describe, expect, it } from 'vitest';
import { BookDoubles, guest, owner } from '../testing/book-doubles.test-support.js';
import { OrganiseBook } from './organise-book.usecase.js';

function subject(current: ReturnType<typeof BookDoubles.library>) {
    return new OrganiseBook(current.loader, current.organiser, current.viewer, current.operations);
}

describe('OrganiseBook', () => {
    it('places the book on a shelf and shows it', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = await subject(current).execute(owner, book.id, { shelfId: 'shelf-3' });

        expect(result.location).toEqual({
            bookcaseId: 'oak',
            bookcaseName: 'Oak',
            shelfId: 'shelf-3',
            shelfName: 'Shelf 3',
        });
    });
    it('tags the book, leaving its information unchanged', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = await subject(current).execute(owner, book.id, {
            tags: [{ name: 'Fantasy' }],
        });

        expect(result.tags).toEqual([{ id: 'tag-Fantasy', name: 'Fantasy' }]);
        expect(result.updatedAt).toBe(book.updatedAt);
    });
    it('records the previous and new location and tags', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, { shelfId: 'top' });

        await subject(current).execute(owner, book.id, { shelfId: null });

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.organised',
            subjectId: book.id,
            before: { title: book.title, location: { shelfId: 'top' }, tags: [] },
            after: { title: book.title, location: null, tags: [] },
        });
    });
    it('records a tag it created in the same operation', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        await subject(current).execute(owner, book.id, { tags: [{ name: 'Fantasy' }] });

        expect(current.trail.entries.slice(-2)).toEqual([
            expect.objectContaining({ operationId: 'operation-2', category: 'book.organised' }),
            expect.objectContaining({ operationId: 'operation-2', category: 'tag.created' }),
        ]);
    });
    it('refuses an unknown shelf and keeps the location', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, { shelfId: 'top' });

        const result = subject(current).execute(owner, book.id, { shelfId: 'unknown' });

        await expect(result).rejects.toMatchObject({ reason: 'shelf-missing' });
        expect(current.shelving.placed.get(book.id)).toBe('top');
    });
    it('reports an unknown book', async () => {
        const current = BookDoubles.library();

        const result = subject(current).execute(owner, 'unknown', { shelfId: null });

        await expect(result).rejects.toMatchObject({ reason: 'book-missing' });
    });
    it('refuses a Guest', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = subject(current).execute(guest, book.id, { shelfId: 'top' });

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.shelving.placed.has(book.id)).toBe(false);
    });
});
