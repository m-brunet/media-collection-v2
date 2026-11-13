import { describe, expect, it } from 'vitest';
import { BookDoubles } from '../testing/book-doubles.test-support.js';
import { CollectionMemberCategories } from './collection-member-categories.service.js';

describe('CollectionMemberCategories', () => {
    it('changes the category of every book and reports each change', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1);
        const two = await BookDoubles.volume(current, 2);

        const result = await new CollectionMemberCategories(current.books, current.clock).change(
            'comics',
            [one.id, two.id],
        );

        expect(current.books.books.get(one.id)?.details.category).toBe('comics');
        expect(current.books.books.get(two.id)?.details.category).toBe('comics');
        expect(result).toEqual([
            {
                category: 'book.category-changed',
                subjectType: 'book',
                subjectId: one.id,
                before: { title: 'Gunnm Vol. 1', category: 'manga', titleGenerated: true },
                after: { title: 'Gunnm Vol. 1', category: 'comics', titleGenerated: true },
            },
            {
                category: 'book.category-changed',
                subjectType: 'book',
                subjectId: two.id,
                before: { title: 'Gunnm Vol. 2', category: 'manga', titleGenerated: true },
                after: { title: 'Gunnm Vol. 2', category: 'comics', titleGenerated: true },
            },
        ]);
    });

    it('keeps a generated title as a hand-written one when changing to Books', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1);

        await new CollectionMemberCategories(current.books, current.clock).change('books', [
            one.id,
        ]);

        expect(current.books.books.get(one.id)?.details).toMatchObject({
            title: 'Gunnm Vol. 1',
            titleGenerated: false,
            category: 'books',
        });
    });

    it('reports nothing for a book already in the category', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1);

        const result = await new CollectionMemberCategories(current.books, current.clock).change(
            'manga',
            [one.id],
        );

        expect(result).toEqual([]);
    });

    it('skips a book that no longer exists', async () => {
        const current = BookDoubles.library();

        const result = await new CollectionMemberCategories(current.books, current.clock).change(
            'comics',
            ['gone'],
        );

        expect(result).toEqual([]);
    });
});
