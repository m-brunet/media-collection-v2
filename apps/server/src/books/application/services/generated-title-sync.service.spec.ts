import { expect, it } from 'vitest';
import { library } from '../testing/book-doubles.test-support.js';
import { Book } from '../../domain/entities/book.entity.js';
import type { BookDetails } from '../../domain/entities/book.entity.js';

const gunnm = { id: 'gunnm', name: 'Gunnm', volumeFrom: 3, volumeTo: 3 };

// A saved no-ISBN Manga by one author, as a book save leaves it before its membership applies.
async function stored(current: ReturnType<typeof library>, overrides: Partial<BookDetails> = {}) {
    const book = new Book({
        id: 'book-' + current.books.books.size,
        details: {
            title: '… - 3',
            titleGenerated: true,
            isbn: null,
            noIsbn: true,
            authorIds: ['kishiro'],
            category: 'manga',
            ownership: 'owned',
            publisher: null,
            publicationDate: null,
            summary: null,
            pageCount: null,
            price: null,
            ...overrides,
        },
        coverFile: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await current.books.create(book);

    return book;
}

it('gives a generated title its final text from the collection the book joined', async () => {
    const current = library();
    const book = await stored(current);

    await current.titles.apply(book, gunnm, false);

    expect(current.books.books.get(book.id)!.details).toMatchObject({
        title: 'Gunnm - 3',
        titleGenerated: true,
    });
});

it('leaves a supplied title as it is', async () => {
    const current = library();
    const book = await stored(current, { title: 'The scrapyard', titleGenerated: false });

    await current.titles.apply(book, gunnm, false);

    expect(current.books.books.get(book.id)!.details.title).toBe('The scrapyard');
});

it('leaves a book without collection as it is', async () => {
    const current = library();
    const book = await stored(current);

    await current.titles.apply(book, null, false);

    expect(current.books.books.get(book.id)!.details.title).toBe('… - 3');
});

it('warns about a possible duplicate of the final title', async () => {
    const current = library();

    await stored(current, { title: 'Gunnm - 3' });
    const book = await stored(current);

    const result = current.titles.apply(book, gunnm, false);

    await expect(result).rejects.toMatchObject({ reason: 'possible-duplicate' });
});

it('keeps a possible duplicate once the person confirmed it is another edition', async () => {
    const current = library();

    await stored(current, { title: 'Gunnm - 3' });
    const book = await stored(current);

    await current.titles.apply(book, gunnm, true);

    expect(current.books.books.get(book.id)!.details.title).toBe('Gunnm - 3');
});
