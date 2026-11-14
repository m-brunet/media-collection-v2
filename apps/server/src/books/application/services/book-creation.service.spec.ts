import { describe, expect, it } from 'vitest';
import { BookDoubles, owner } from '../testing/book-doubles.test-support.js';

describe('BookCreation', () => {
    it('saves the book with the identifier it is given, in its collection and place', async () => {
        const current = BookDoubles.library();

        const created = await current.creation.create(
            owner,
            'book-7',
            BookDoubles.input({
                collection: { collection: { name: 'Gunnm' }, volumeFrom: 7, volumeTo: 7 },
                shelfId: 'shelf-3',
            }),
            false,
        );

        expect(created.book.id).toBe('book-7');
        expect(await current.books.findById('book-7')).not.toBeNull();
        expect(await current.collections.of('book-7')).toMatchObject({ volumeFrom: 7 });
        expect(current.shelving.placed.get('book-7')).toBe('shelf-3');
        expect(created.after).toMatchObject({
            title: 'Piranesi',
            collection: { name: 'Gunnm', volumeFrom: 7, volumeTo: 7 },
            location: { shelfId: 'shelf-3' },
        });
    });

    it('marks the book read for the person creating it when asked', async () => {
        const current = BookDoubles.library();

        await current.creation.create(owner, 'book-7', BookDoubles.input(), true);

        expect(await current.readings.isRead(owner.id, 'book-7')).toBe(true);
    });

    it('refuses an ISBN already saved before saving anything', async () => {
        const current = BookDoubles.library();

        await BookDoubles.saved(current);

        const result = current.creation.create(owner, 'book-7', BookDoubles.input(), false);

        await expect(result).rejects.toMatchObject({ reason: 'isbn-taken' });
        expect(await current.books.findById('book-7')).toBeNull();
    });

    it('removes the planned books the new book replaces', async () => {
        const current = BookDoubles.library();
        const planned = await BookDoubles.saved(current, {
            title: '',
            isbn: null,
            noIsbn: true,
            ownership: 'not-owned',
            category: 'manga',
            collection: { collection: { name: 'Gunnm' }, volumeFrom: 2, volumeTo: 2 },
        });

        const created = await current.creation.create(
            owner,
            'book-7',
            BookDoubles.input({
                title: '',
                category: 'manga',
                collection: { collection: { name: 'Gunnm' }, volumeFrom: 2, volumeTo: 2 },
                replacePlanned: [planned.id],
            }),
            false,
        );

        expect(created.replaced.map((removed) => removed.book.id)).toEqual([planned.id]);
        expect(await current.books.findById(planned.id)).toBeNull();
    });
});
