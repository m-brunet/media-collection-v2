import { describe, expect, it } from 'vitest';
import { Book } from '../domain/entities/book.entity.js';
import { Isbn } from '../domain/value-objects/isbn.value-object.js';
import { Price } from '../domain/value-objects/price.value-object.js';
import { PublicationDate } from '../domain/value-objects/publication-date.value-object.js';
import { BookSnapshot } from './book-audit.js';

function book(coverFile: string | null) {
    return new Book({
        id: 'b1',
        details: {
            title: 'Piranesi',
            titleGenerated: false,
            isbn: Isbn.parse('0306406152'),
            noIsbn: false,
            authorIds: ['a1'],
            category: 'books',
            ownership: 'owned',
            publisher: 'Bloomsbury',
            publicationDate: PublicationDate.from(2020, 9),
            summary: null,
            pageCount: 272,
            price: Price.parse('16,90'),
        },
        coverFile,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    });
}

describe('BookSnapshot', () => {
    it('records the shared information in plain values', () => {
        const result = BookSnapshot.of(book(null));

        expect(result).toEqual({
            title: 'Piranesi',
            isbn: '9780306406157',
            noIsbn: false,
            authorIds: ['a1'],
            category: 'books',
            ownership: 'owned',
            publisher: 'Bloomsbury',
            publicationYear: 2020,
            publicationMonth: 9,
            summary: null,
            pageCount: 272,
            priceCents: 1690,
            hasCover: false,
        });
    });
    it('records whether there is a cover, never the stored file name', () => {
        const result = BookSnapshot.of(book('1b2c3d4e-0000-4000-8000-000000000000.png'));

        expect(result.hasCover).toBe(true);
        expect(JSON.stringify(result)).not.toContain('.png');
    });
    it('records the collection membership when the change concerns it', () => {
        const collection = { id: 'c1', name: 'Batman', volumeFrom: 1, volumeTo: 3 };

        const result = BookSnapshot.of(book(null), { collection });

        expect(result.collection).toEqual(collection);
    });
    it('records a book outside any collection', () => {
        const collection = null;

        const result = BookSnapshot.of(book(null), { collection });

        expect(result.collection).toBeNull();
    });
    it('leaves membership out when the change does not concern it', () => {
        const subject = book(null);

        const result = BookSnapshot.of(subject);

        expect(result).not.toHaveProperty('collection');
    });
    it('records the location and tags when the change concerns them', () => {
        const organisation = {
            location: {
                bookcaseId: 'oak',
                bookcaseName: 'Oak',
                shelfId: 's3',
                shelfName: 'Shelf 3',
            },
            tags: [{ id: 't1', name: 'Fantasy' }],
        };

        const result = BookSnapshot.of(book(null), { organisation });

        expect(result).toMatchObject(organisation);
    });
    it('records only the location and tags of an organisation change', () => {
        const organisation = { location: null, tags: [] };

        const result = BookSnapshot.organisation(organisation);

        expect(result).toEqual({ location: null, tags: [] });
    });
});
