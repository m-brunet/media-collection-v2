import { describe, expect, it } from 'vitest';
import { BookDoubles, guest, owner } from '../testing/book-doubles.test-support.js';
import { PlaceBooksOnShelf } from './place-books-on-shelf.usecase.js';

function subject(current: ReturnType<typeof BookDoubles.library>) {
    return new PlaceBooksOnShelf(
        current.loader,
        current.shelving,
        current.organiser,
        current.operations,
    );
}

const oak = { bookcaseId: 'oak', bookcaseName: 'Oak', shelfId: 'shelf-3', shelfName: 'Shelf 3' };

describe('PlaceBooksOnShelf', () => {
    it('places books that had no location', async () => {
        const current = BookDoubles.library();
        const first = await BookDoubles.saved(current, { title: 'Piranesi' });
        const second = await BookDoubles.saved(current, {
            title: 'Circe',
            isbn: null,
            noIsbn: true,
        });

        const result = await subject(current).execute(owner, {
            shelfId: 'shelf-3',
            bookIds: [first.id, second.id],
        });

        expect(result).toEqual({
            shelf: oak,
            placed: [
                { id: first.id, title: 'Piranesi' },
                { id: second.id, title: 'Circe' },
            ],
            moved: [],
            unchanged: [],
        });
        expect([...current.shelving.placed.values()]).toEqual(['shelf-3', 'shelf-3']);
    });
    it('moves a book from another shelf and tells where it was', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, { shelfId: 'top' });

        const result = await subject(current).execute(owner, {
            shelfId: 'shelf-3',
            bookIds: [book.id],
        });

        expect(result.moved).toEqual([
            {
                id: book.id,
                title: book.title,
                from: {
                    bookcaseId: 'study',
                    bookcaseName: 'Study',
                    shelfId: 'top',
                    shelfName: 'Top',
                },
            },
        ]);
        expect(current.shelving.placed.get(book.id)).toBe('shelf-3');
    });
    it('leaves a book already on the shelf unchanged', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, { shelfId: 'shelf-3' });

        const result = await subject(current).execute(owner, {
            shelfId: 'shelf-3',
            bookIds: [book.id],
        });

        expect(result).toMatchObject({
            placed: [],
            moved: [],
            unchanged: [{ id: book.id, title: book.title }],
        });
    });
    it('places a lent book', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        current.loans.lend(book.id);

        const result = await subject(current).execute(owner, {
            shelfId: 'shelf-3',
            bookIds: [book.id],
        });

        expect(result.placed).toHaveLength(1);
    });
    it('counts a book given twice once', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = await subject(current).execute(owner, {
            shelfId: 'shelf-3',
            bookIds: [book.id, book.id],
        });

        expect(result.placed).toHaveLength(1);
    });
    it('keeps the tags of the books it places', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, { tags: [{ name: 'Fantasy' }] });

        await subject(current).execute(owner, { shelfId: 'shelf-3', bookIds: [book.id] });

        expect(await current.organiser.current(book.id)).toMatchObject({
            location: { shelfId: 'shelf-3' },
            tags: [{ name: 'Fantasy' }],
        });
    });
    it('records one operation on the shelf, with one change per book that moved', async () => {
        const current = BookDoubles.library();
        const placed = await BookDoubles.saved(current, { title: 'Piranesi' });
        const moved = await BookDoubles.saved(current, {
            title: 'Circe',
            isbn: null,
            noIsbn: true,
            shelfId: 'top',
        });
        const there = await BookDoubles.saved(current, {
            title: 'Babel',
            isbn: null,
            noIsbn: true,
            shelfId: 'shelf-3',
        });
        const before = current.trail.entries.length;

        await subject(current).execute(owner, {
            shelfId: 'shelf-3',
            bookIds: [placed.id, moved.id, there.id],
        });

        const entries = current.trail.entries.slice(before);

        expect(entries).toEqual([
            expect.objectContaining({
                category: 'shelf.books-placed',
                subjectType: 'shelf',
                subjectId: 'shelf-3',
                before: {
                    name: 'Shelf 3',
                    bookcaseName: 'Oak',
                    bookIds: [placed.id, moved.id, there.id],
                },
                after: {
                    name: 'Shelf 3',
                    bookcaseName: 'Oak',
                    placed: [placed.id],
                    moved: [moved.id],
                    unchanged: [there.id],
                },
            }),
            expect.objectContaining({
                category: 'book.organised',
                subjectId: placed.id,
                before: { title: 'Piranesi', location: null, tags: [] },
                after: { title: 'Piranesi', location: oak, tags: [] },
            }),
            expect.objectContaining({
                category: 'book.organised',
                subjectId: moved.id,
                before: expect.objectContaining({
                    location: expect.objectContaining({ shelfId: 'top' }),
                }),
                after: expect.objectContaining({ location: oak }),
            }),
        ]);
        expect(new Set(entries.map((entry) => entry.operationId)).size).toBe(1);
    });
    it('refuses an unknown shelf and places nothing', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = subject(current).execute(owner, {
            shelfId: 'unknown',
            bookIds: [book.id],
        });

        await expect(result).rejects.toMatchObject({ reason: 'shelf-missing' });
        expect(current.shelving.placed.size).toBe(0);
    });
    it('refuses an unknown book and places none of the others', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = subject(current).execute(owner, {
            shelfId: 'shelf-3',
            bookIds: [book.id, 'unknown'],
        });

        await expect(result).rejects.toMatchObject({ reason: 'book-missing' });
        expect(current.shelving.placed.size).toBe(0);
    });
    it('refuses a Not Owned book and places none of the others', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);
        const planned = await BookDoubles.saved(current, {
            title: 'Circe',
            isbn: null,
            noIsbn: true,
            ownership: 'not-owned',
        });

        const result = subject(current).execute(owner, {
            shelfId: 'shelf-3',
            bookIds: [book.id, planned.id],
        });

        await expect(result).rejects.toMatchObject({
            reason: 'book-not-owned',
            details: { bookId: planned.id },
        });
        expect(current.shelving.placed.size).toBe(0);
    });
    it('refuses more than a hundred books', async () => {
        const current = BookDoubles.library();
        const bookIds = Array.from({ length: 101 }, (_, index) => 'book-' + index);

        const result = subject(current).execute(owner, { shelfId: 'shelf-3', bookIds });

        await expect(result).rejects.toMatchObject({ reason: 'shelf-placement-size' });
    });
    it('refuses an empty list', async () => {
        const current = BookDoubles.library();

        const result = subject(current).execute(owner, { shelfId: 'shelf-3', bookIds: [] });

        await expect(result).rejects.toMatchObject({ reason: 'shelf-placement-size' });
    });
    it('refuses a Guest', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = subject(current).execute(guest, {
            shelfId: 'shelf-3',
            bookIds: [book.id],
        });

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
        expect(current.shelving.placed.size).toBe(0);
    });
});
