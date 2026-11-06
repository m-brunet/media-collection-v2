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

describe('BookDetailsBuilder titles', () => {
    const gunnm = { collection: { name: 'Gunnm' }, volumeFrom: 3, volumeTo: 3 };

    it('keeps a supplied title as supplied', async () => {
        const current = library();

        const result = await current.builder.build(input({ category: 'manga', collection: gunnm }));

        expect(result).toMatchObject({ title: 'Piranesi', titleGenerated: false });
    });
    it('asks for a generated title when a Manga in a collection has none', async () => {
        const current = library();

        const result = await current.builder.build(
            input({ title: '  ', category: 'manga', collection: gunnm }),
        );

        expect(result).toMatchObject({ title: 'Gunnm Vol. 3', titleGenerated: true });
    });
    it('asks for a generated title when a Comics in a collection has none', async () => {
        const current = library();

        const result = await current.builder.build(
            input({ title: '', category: 'comics', collection: { ...gunnm, volumeTo: 5 } }),
        );

        expect(result).toMatchObject({ title: 'Gunnm Vol. 3–5', titleGenerated: true });
    });
    it('refuses a blank title for a Books record in a collection', async () => {
        const current = library();

        const result = current.builder.build(
            input({ title: '', category: 'books', collection: gunnm }),
        );

        await expect(result).rejects.toMatchObject({ reason: 'title-required' });
    });
    it('refuses a blank title for a Manga outside any collection', async () => {
        const current = library();

        const result = current.builder.build(
            input({ title: ' ', category: 'manga', collection: null }),
        );

        await expect(result).rejects.toMatchObject({ reason: 'title-required' });
    });
});
