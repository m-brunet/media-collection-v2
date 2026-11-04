import { describe, expect, it } from 'vitest';
import type { BookDto } from '../../../../../packages/contracts/src/http';
import { BookDraft } from './book-draft.util';

function book(overrides: Partial<BookDto> = {}): BookDto {
    return {
        id: 'b1',
        title: 'Piranesi',
        isbn: '9781635575637',
        isbnConvertedFromIsbn10: false,
        noIsbn: false,
        authors: [{ id: 'a1', name: 'Susanna Clarke' }],
        category: 'books',
        ownership: 'owned',
        publisher: 'Bloomsbury',
        publicationYear: 2020,
        publicationMonth: 9,
        summary: null,
        pageCount: 272,
        priceCents: 1690,
        hasCover: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        personal: { read: true, note: { text: 'Mine.', updatedAt: '2026-01-01T00:00:00.000Z' } },
        ...overrides,
    };
}

describe('BookDraft', () => {
    it('starts a new book as an owned, unread Book', () => {
        const result = BookDraft.empty();

        expect(result).toMatchObject({ category: 'books', ownership: 'owned', read: false });
    });
    it('fills the form from a saved book with the price in the interface language', () => {
        const result = BookDraft.fromBook(book(), 'fr-FR');

        expect(result).toMatchObject({
            price: '16,90',
            publicationMonth: '9',
            publicationYear: '2020',
            read: true,
            note: 'Mine.',
        });
    });
    it('sends blank optional fields as unknown', () => {
        const values = { ...BookDraft.empty(), title: 'T', price: ' ', pageCount: '' };

        const result = BookDraft.toInput(values);

        expect(result).toMatchObject({ price: null, pageCount: null, publisher: null });
    });
    it('sends no ISBN when the book has none', () => {
        const values = { ...BookDraft.empty(), isbn: '978', noIsbn: true };

        const result = BookDraft.toInput(values);

        expect(result.isbn).toBeNull();
    });
    it('sends existing authors by identity and new ones by name', () => {
        const values = {
            ...BookDraft.empty(),
            authors: [
                { id: 'a1', name: 'Susanna Clarke', distinct: false },
                { id: null, name: 'Sam Tayler', distinct: true },
            ],
        };

        const result = BookDraft.toInput(values);

        expect(result.authors).toEqual([{ id: 'a1' }, { name: 'Sam Tayler', distinct: true }]);
    });
    it('confirms a distinct no-ISBN edition only when asked', () => {
        const result = BookDraft.toInput(BookDraft.empty(), true);

        expect(result.confirmDistinct).toBe(true);
    });
    it('treats an emptied note as removed', () => {
        const values = { ...BookDraft.empty(), note: '   ' };

        const result = BookDraft.note(values);

        expect(result).toBeNull();
    });
    it('sees no change when only an empty note was opened', () => {
        const result = BookDraft.same(BookDraft.empty(), { ...BookDraft.empty(), note: '' });

        expect(result).toBe(true);
    });
    it('sees a changed title', () => {
        const result = BookDraft.same(BookDraft.empty(), { ...BookDraft.empty(), title: 'T' });

        expect(result).toBe(false);
    });
    it('replaces a typed name with the chosen existing author', () => {
        const values = {
            ...BookDraft.empty(),
            authors: [{ id: null, name: 'Sam Tayler', distinct: false }],
        };

        const result = BookDraft.resolveAuthor(values, 'sam tayler', {
            id: 'a2',
            name: 'Sam Taylor',
        });

        expect(result.authors).toEqual([{ id: 'a2', name: 'Sam Taylor', distinct: false }]);
    });
    it('marks a typed name as a different author', () => {
        const values = {
            ...BookDraft.empty(),
            authors: [{ id: null, name: 'Sam Tayler', distinct: false }],
        };

        const result = BookDraft.resolveAuthor(values, 'Sam Tayler', 'distinct');

        expect(result.authors[0]!.distinct).toBe(true);
    });
    it('compares names without case, accents or outer spaces', () => {
        const result = BookDraft.nameKey('  Hervé BAZIN ');

        expect(result).toBe('herve bazin');
    });
});
