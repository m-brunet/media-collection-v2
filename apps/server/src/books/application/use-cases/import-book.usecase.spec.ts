import { describe, expect, it } from 'vitest';
import type { ImportedBook } from '../ports/driving/import-book-use-case.interface.js';
import { administrator, guest, library, saved } from '../testing/book-doubles.test-support.js';
import { ImportBook } from './import-book.usecase.js';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1]);

function subject(current = library()) {
    return new ImportBook(
        current.books,
        current.builder,
        current.identity,
        current.titles,
        current.collections,
        current.readings,
        current.covers,
        current.ids,
        current.clock,
        current.operations,
    );
}

function imported(overrides: Partial<ImportedBook> = {}): ImportedBook {
    return {
        title: 'Magicien - L’apprenti',
        isbn: '9782811211554',
        authors: ['Raymond E. Feist'],
        category: 'books',
        ownership: 'owned',
        publisher: 'Milady',
        pageCount: 470,
        price: '9.9',
        collection: null,
        createdAt: '2017-01-15T16:53:12.369Z',
        read: false,
        cover: null,
        ...overrides,
    };
}

describe('ImportBook', () => {
    it('keeps the original creation date and is updated now', async () => {
        const current = library();

        const result = await subject(current).execute(administrator, imported());

        const book = current.books.books.get(result.bookId)!.snapshot;

        expect(book).toMatchObject({
            createdAt: '2017-01-15T16:53:12.369Z',
            updatedAt: '2026-03-01T10:00:00.000Z',
        });
        expect(book.details).toMatchObject({ title: 'Magicien - L’apprenti', pageCount: 470 });
        expect(book.details.price?.cents).toBe(990);
    });
    it('records the import as a creation by the importing account, now', async () => {
        const current = library();

        const result = await subject(current).execute(administrator, imported());

        expect(current.trail.entries).toMatchObject([
            {
                category: 'book.created',
                outcome: 'successful',
                actorId: 'alex',
                // The audit's own clock: when the import ran, not the original creation date.
                occurredAt: '2026-01-01T00:00:00.000Z',
                subjectId: result.bookId,
            },
        ]);
    });
    it('keeps a similar author name as another author', async () => {
        const current = library();

        await saved(current, { authors: [{ name: 'Raymond E. Feist' }], isbn: '9780306406157' });

        await subject(current).execute(administrator, imported({ authors: ['Raymond E. Fiest'] }));

        expect(current.authors.authors.size).toBe(2);
    });
    it('joins the collection with its single volume and generates a missing title', async () => {
        const current = library();
        const book = imported({
            title: '',
            category: 'manga',
            collection: { name: 'Gunnm', volume: 3 },
        });

        const result = await subject(current).execute(administrator, book);

        expect(result.collectionId).toBe('collection-Gunnm');
        expect(current.collections.memberships.get(result.bookId)).toMatchObject({
            volumeFrom: 3,
            volumeTo: 3,
        });
        expect(current.books.books.get(result.bookId)!.details).toMatchObject({
            title: 'Gunnm Vol. 3',
            titleGenerated: true,
        });
    });
    it('gives an untitled Book in a collection its collection title, as supplied', async () => {
        const current = library();
        const book = imported({ title: '', collection: { name: 'Gunnm', volume: 3 } });

        const result = await subject(current).execute(administrator, book);

        expect(result.title).toBe('Gunnm Vol. 3');
        expect(current.books.books.get(result.bookId)!.details).toMatchObject({
            title: 'Gunnm Vol. 3',
            titleGenerated: false,
        });
    });
    it('refuses a missing title for a book outside a collection', async () => {
        const current = library();
        const book = imported({ title: '' });

        const result = subject(current).execute(administrator, book);

        await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
        expect(current.books.books.size).toBe(0);
    });
    it('sets the importing account as having read the book', async () => {
        const current = library();

        const result = await subject(current).execute(administrator, imported({ read: true }));

        expect(await current.readings.isRead('alex', result.bookId)).toBe(true);
    });
    it('stores a usable cover', async () => {
        const current = library();

        const result = await subject(current).execute(administrator, imported({ cover: png }));

        expect(result.cover).toBe('stored');
        expect(current.books.books.get(result.bookId)!.snapshot.coverFile).toBe('cover-1');
        expect(current.covers.files.get('cover-1')?.mediaType).toBe('image/png');
    });
    it('leaves out a cover that is not a JPEG, PNG or WebP image', async () => {
        const current = library();

        const result = await subject(current).execute(administrator, imported({ cover: gif }));

        expect(result.cover).toBe('rejected');
        expect(current.books.books.get(result.bookId)!.snapshot.coverFile).toBeNull();
        expect(current.covers.files.size).toBe(0);
    });
    it('removes the stored cover when the book cannot be saved', async () => {
        const current = library();

        await saved(current, { isbn: '9782811211554' });

        const result = subject(current).execute(administrator, imported({ cover: png }));

        await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'isbn-taken' });
        expect(current.covers.files.size).toBe(0);
    });
    it('refuses a creation date in the future', async () => {
        const current = library();
        const book = imported({ createdAt: '2027-01-01T00:00:00.000Z' });

        const result = subject(current).execute(administrator, book);

        await expect(result).rejects.toMatchObject({ reason: 'created-at-invalid' });
        expect(current.books.books.size).toBe(0);
    });
    it('refuses a Guest', async () => {
        const current = library();

        const result = subject(current).execute(guest, imported());

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
        expect(current.books.books.size).toBe(0);
    });
});
