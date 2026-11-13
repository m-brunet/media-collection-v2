import { describe, expect, it } from 'vitest';
import type { BookDto, CategoryMismatchDetails } from '../../../../../packages/contracts/src/http';
import { BookDraft } from './book-draft.util';
import { CategoryMismatch } from './category-mismatch.util';

const details: CategoryMismatchDetails = {
    collectionId: 'naruto',
    name: 'Naruto',
    category: 'manga',
    bookCategory: 'comics',
    bookCount: 12,
};

function saved(overrides: Partial<BookDto> = {}): BookDto {
    return {
        category: 'manga',
        collection: { id: 'naruto', name: 'Naruto', volumeFrom: 3, volumeTo: 3 },
        ...overrides,
    } as BookDto;
}

describe('CategoryMismatch.changesWholeCollection', () => {
    it('offers the whole collection when a member book got another category', () => {
        const draft = { ...BookDraft.empty(), category: 'comics' as const };

        const result = CategoryMismatch.changesWholeCollection(saved(), draft, details);

        expect(result).toBe(true);
    });

    it('offers the collection category to a new book', () => {
        const draft = { ...BookDraft.empty(), category: 'comics' as const };

        const result = CategoryMismatch.changesWholeCollection(null, draft, details);

        expect(result).toBe(false);
    });

    it('offers the collection category to a book moving into the collection', () => {
        const draft = { ...BookDraft.empty(), category: 'comics' as const };
        const book = saved({ category: 'comics', collection: null });

        const result = CategoryMismatch.changesWholeCollection(book, draft, details);

        expect(result).toBe(false);
    });

    it('offers the collection category to a member whose category stayed the same', () => {
        const draft = { ...BookDraft.empty(), category: 'comics' as const };
        const book = saved({ category: 'comics' });

        const result = CategoryMismatch.changesWholeCollection(book, draft, details);

        expect(result).toBe(false);
    });
});
