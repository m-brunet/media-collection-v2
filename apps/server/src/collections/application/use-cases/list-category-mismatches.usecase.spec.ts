import { describe, expect, it } from 'vitest';
import { CollectionDoubles } from '../testing/collection-doubles.test-support.js';
import { ListCategoryMismatches } from './list-category-mismatches.usecase.js';

function subject(current: ReturnType<typeof CollectionDoubles.shelf>) {
    return new ListCategoryMismatches(current.mismatches, current.loader);
}

describe('ListCategoryMismatches', () => {
    it('lists the books of another category than their collection', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Naruto', 1);
        await CollectionDoubles.member(current, 'guide', 'owned', 'Naruto', 2);
        current.members.saveBook('guide', 'owned', 'Naruto guide', { category: 'books' });

        const result = await subject(current).execute(null);

        expect(result).toEqual([
            {
                bookId: 'guide',
                title: 'Naruto guide',
                category: 'books',
                collectionId: 'collection-1',
                collectionName: 'Naruto',
                collectionCategory: 'comics',
            },
        ]);
    });

    it('keeps the books of the chosen collection', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'naruto', 'owned', 'Naruto', 1);
        await CollectionDoubles.member(current, 'batman', 'owned', 'Batman', 1);
        current.members.saveBook('naruto', 'owned', 'Naruto 1', { category: 'manga' });
        current.members.saveBook('batman', 'owned', 'Batman 1', { category: 'manga' });

        const result = await subject(current).execute('collection-2');

        expect(result.map((mismatch) => mismatch.bookId)).toEqual(['batman']);
    });

    it('reports an unknown collection', async () => {
        const current = CollectionDoubles.shelf();

        const result = subject(current).execute('gone');

        await expect(result).rejects.toMatchObject({ reason: 'collection-missing' });
    });
});
