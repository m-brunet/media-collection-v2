import { describe, expect, it } from 'vitest';
import { BookBuilder } from './book-builder.test-support.js';
import { library } from './book-doubles.test-support.js';

describe('BookBuilder.build', () => {
    it('builds an Owned Books record without ISBN by default', () => {
        const builder = new BookBuilder();

        const result = builder.build().details;

        expect(result).toMatchObject({
            category: 'books',
            ownership: 'owned',
            isbn: null,
            noIsbn: true,
            titleGenerated: false,
        });
        expect(result.authorIds).toHaveLength(1);
    });
    it('gives distinct default titles', () => {
        const first = new BookBuilder().build();

        const result = new BookBuilder().build();

        expect(result.titleKey).not.toBe(first.titleKey);
    });
    it('builds a book with the chosen information', () => {
        const builder = new BookBuilder()
            .withTitle('Piranesi')
            .withIsbn('0-306-40615-2')
            .withPublisher('Bloomsbury')
            .withPublicationYear(2020);

        const result = builder.build().details;

        expect(result).toMatchObject({
            title: 'Piranesi',
            noIsbn: false,
            publisher: 'Bloomsbury',
            publicationDate: { year: 2020, month: null },
        });
        expect(result.isbn?.isbn13).toBe('9780306406157');
    });
    it('builds a planned book', () => {
        const builder = new BookBuilder().asPlanned();

        const result = builder.build().details.ownership;

        expect(result).toBe('not-owned');
    });
    it('builds a Manga whose title was generated from its collection', () => {
        const builder = new BookBuilder().asGenerated('Gunnm Vol. 3');

        const result = builder.build().details;

        expect(result).toMatchObject({
            title: 'Gunnm Vol. 3',
            titleGenerated: true,
            category: 'manga',
        });
    });
});

describe('BookBuilder.buildAndSave', () => {
    it('saves the book with its authors', async () => {
        const current = library();

        const result = await new BookBuilder()
            .withTitle('Good Omens')
            .withAuthors('Terry Pratchett', 'Neil Gaiman')
            .buildAndSave(current);

        expect(current.books.books.get(result.id)?.details.title).toBe('Good Omens');
        expect(
            [...current.authors.authors.values()].map((author) => author.snapshot.name).sort(),
        ).toEqual(['Neil Gaiman', 'Terry Pratchett']);
    });
    it('reuses a saved author with an equivalent name', async () => {
        const current = library();
        const first = await new BookBuilder().withAuthors('Susanna Clarke').buildAndSave(current);

        const result = await new BookBuilder().withAuthors('susanna CLARKE').buildAndSave(current);

        expect(result.details.authorIds).toEqual(first.details.authorIds);
        expect(current.authors.authors.size).toBe(1);
    });
});
