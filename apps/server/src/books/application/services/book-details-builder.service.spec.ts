import { describe, expect, it } from 'vitest';
import { input, library } from '../testing/book-doubles.test-support.js';

describe('BookDetailsBuilder', () => {
    it('parses the ISBN, price and publication date', async () => {
        const current = library();

        const result = await current.builder.build(
            input({ price: '12,5', publicationYear: 2020, publicationMonth: 9 }),
        );

        expect(result.isbn!.isbn13).toBe('9781635575637');
        expect(result.price!.cents).toBe(1250);
        expect(result.publicationDate).toMatchObject({ year: 2020, month: 9 });
    });
    it('ignores a typed ISBN when the book has none', async () => {
        const current = library();

        const result = await current.builder.build(input({ isbn: '123', noIsbn: true }));

        expect(result.isbn).toBeNull();
    });
    it('treats a blank price as unknown', async () => {
        const current = library();

        const result = await current.builder.build(input({ price: '  ' }));

        expect(result.price).toBeNull();
    });
    it('resolves the authors', async () => {
        const current = library();

        const result = await current.builder.build(input());

        expect(result.authorIds).toEqual(['id-1']);
    });
});
