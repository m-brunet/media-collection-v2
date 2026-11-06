import { describe, expect, it } from 'vitest';
import type { BookDto } from '../../../../../packages/contracts/src/http';
import { BookDraft } from './book-draft.util';

function book(overrides: Partial<BookDto> = {}): BookDto {
    return {
        id: 'b1',
        title: 'Piranesi',
        titleGenerated: false,
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
        collection: null,
        location: null,
        tags: [],
        loan: null,
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
        const result = BookDraft.toInput(BookDraft.empty(), { confirmDistinct: true });

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
    it('sends no membership outside a collection', () => {
        const values = { ...BookDraft.empty(), collectionName: 'Batman', volumeFrom: '2' };

        const result = BookDraft.toInput(values);

        expect(result.collection).toBeNull();
    });
    it('sends a single volume as an equal range', () => {
        const values = { ...BookDraft.inCollection(' Batman '), volumeFrom: '3', volumeTo: '9' };

        const result = BookDraft.toInput(values);

        expect(result.collection).toEqual({
            collection: { name: 'Batman' },
            volumeFrom: 3,
            volumeTo: 3,
        });
    });
    it('sends an omnibus range with the answers given in dialogs', () => {
        const values = {
            ...BookDraft.inCollection('Batman'),
            omnibus: true,
            volumeFrom: '0',
            volumeTo: '3',
            collectionDistinct: true,
            enableVolumeZero: true,
        };

        const result = BookDraft.toInput(values, { replacePlanned: ['p1'] });

        expect(result).toMatchObject({
            collection: {
                collection: { name: 'Batman', distinct: true },
                volumeFrom: 0,
                volumeTo: 3,
                enableVolumeZero: true,
            },
            replacePlanned: ['p1'],
        });
    });
    it('fills the collection part from a saved omnibus', () => {
        const saved = book({
            collection: { id: 'c1', name: 'Batman', volumeFrom: 1, volumeTo: 3 },
        });

        const result = BookDraft.fromBook(saved, 'en-GB');

        expect(result).toMatchObject({
            inCollection: true,
            collectionName: 'Batman',
            omnibus: true,
            volumeFrom: '1',
            volumeTo: '3',
        });
    });
    it('asks for the collection name and volume before saving', () => {
        const values = BookDraft.inCollection('');

        const problems = [
            BookDraft.collectionProblem(values),
            BookDraft.collectionProblem({ ...values, collectionName: 'Batman' }),
            BookDraft.collectionProblem({ ...values, collectionName: 'Batman', volumeFrom: '1' }),
        ];

        expect(problems).toEqual(['collection-name-required', 'volume-required', null]);
    });
    it('fills the location and tags from a saved book', () => {
        const saved = book({
            location: {
                bookcaseId: 'oak',
                bookcaseName: 'Oak',
                shelfId: 's3',
                shelfName: 'Shelf 3',
            },
            tags: [{ id: 't1', name: 'Fantasy' }],
        });

        const result = BookDraft.fromBook(saved, 'en-GB');

        expect(result).toMatchObject({
            bookcaseId: 'oak',
            shelfId: 's3',
            tags: [{ id: 't1', name: 'Fantasy' }],
        });
    });
    it('sends existing tags by identity and new ones by name', () => {
        const values = {
            ...BookDraft.empty(),
            bookcaseId: 'oak',
            shelfId: 's3',
            tags: [
                { id: 't1', name: 'Fantasy' },
                { id: null, name: 'Medieval' },
            ],
        };

        const result = BookDraft.toInput(values);

        expect(result).toMatchObject({ shelfId: 's3', tags: [{ id: 't1' }, { name: 'Medieval' }] });
    });
    it('sends no shelf once the bookcase is unassigned', () => {
        const values = { ...BookDraft.empty(), bookcaseId: null, shelfId: 's3' };

        const result = BookDraft.toInput(values);

        expect(result.shelfId).toBeNull();
    });
    it('asks for a shelf when only a bookcase is chosen', () => {
        const values = { ...BookDraft.empty(), bookcaseId: 'oak' };

        const problems = [
            BookDraft.locationProblem(values),
            BookDraft.locationProblem({ ...values, shelfId: 's3' }),
            BookDraft.locationProblem(BookDraft.empty()),
        ];

        expect(problems).toEqual(['shelf-required', null, null]);
    });
});
