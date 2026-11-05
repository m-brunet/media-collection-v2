import { describe, expect, it } from 'vitest';
import { guest, input, library, owner, saved } from '../testing/book-doubles.test-support.js';
import { CreateBook } from './create-book.usecase.js';

function subject(current = library()) {
    return new CreateBook(
        current.books,
        current.builder,
        current.identity,
        current.collections,
        current.removal,
        current.organiser,
        current.readings,
        current.covers,
        current.viewer,
        current.ids,
        current.clock,
        current.operations,
    );
}

describe('CreateBook', () => {
    it('saves an edition with its author', async () => {
        const current = library();

        const result = await subject(current).execute(owner, input(), false);

        expect(result).toMatchObject({
            title: 'Piranesi',
            isbn: '9781635575637',
            authors: [{ name: 'Susanna Clarke' }],
            category: 'books',
            ownership: 'owned',
            hasCover: false,
        });
        expect(current.books.books.size).toBe(1);
    });
    it('converts an ISBN-10 and remembers the conversion', async () => {
        const current = library();

        const result = await subject(current).execute(owner, input({ isbn: '0306406152' }), false);

        expect(result).toMatchObject({ isbn: '9780306406157', isbnConvertedFromIsbn10: true });
    });
    it('refuses a second record of the same edition, even entered as ISBN-10', async () => {
        const current = library();

        await saved(current, { isbn: '9780306406157' });

        const result = subject(current).execute(owner, input({ isbn: '0-306-40615-2' }), false);

        await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'isbn-taken' });
        expect(current.books.books.size).toBe(1);
    });
    it('reuses an author whose name differs only by case and accents', async () => {
        const current = library();

        await saved(current, { authors: [{ name: 'Hervé Bazin' }], isbn: '9780306406157' });

        await subject(current).execute(
            owner,
            input({ authors: [{ name: ' herve BAZIN ' }] }),
            false,
        );

        expect(current.authors.authors.size).toBe(1);
    });
    it('asks before creating an author with a similar name', async () => {
        const current = library();

        await saved(current, { authors: [{ name: 'Sam Taylor' }], isbn: '9780306406157' });

        const result = subject(current).execute(
            owner,
            input({ authors: [{ name: 'Sam Tayler' }] }),
            false,
        );

        await expect(result).rejects.toMatchObject({
            reason: 'author-similar',
            details: { name: 'Sam Tayler', candidates: [{ name: 'Sam Taylor' }] },
        });
        expect(current.books.books.size).toBe(1);
    });
    it('creates a distinct author once confirmed', async () => {
        const current = library();

        await saved(current, { authors: [{ name: 'Sam Taylor' }], isbn: '9780306406157' });

        await subject(current).execute(
            owner,
            input({ authors: [{ name: 'Sam Tayler', distinct: true }] }),
            false,
        );

        expect(current.authors.authors.size).toBe(2);
    });
    it('warns about a possible duplicate of a book without ISBN', async () => {
        const current = library();
        const noIsbn = { isbn: null, noIsbn: true };

        await saved(current, noIsbn);

        const result = subject(current).execute(owner, input(noIsbn), false);

        await expect(result).rejects.toMatchObject({
            reason: 'possible-duplicate',
            details: { candidates: [{ title: 'Piranesi', authors: ['Susanna Clarke'] }] },
        });
    });
    it('saves a distinct book without ISBN once confirmed', async () => {
        const current = library();
        const noIsbn = { isbn: null, noIsbn: true };

        await saved(current, noIsbn);

        await subject(current).execute(owner, input({ ...noIsbn, confirmDistinct: true }), false);

        expect(current.books.books.size).toBe(2);
    });
    it('records the creator reading status only for the creator', async () => {
        const current = library();

        const result = await subject(current).execute(owner, input(), true);

        expect(result.personal).toEqual({ read: true, note: null });
        expect([...current.readings.statuses.keys()]).toEqual(['camille/' + result.id]);
    });
    it('records the creation for the audit and future Activity', async () => {
        const current = library();

        const result = await subject(current).execute(owner, input({ price: '16,90' }), false);

        expect(current.trail.entries).toEqual([
            expect.objectContaining({
                category: 'book.created',
                outcome: 'successful',
                subjectId: result.id,
                after: expect.objectContaining({ title: 'Piranesi', priceCents: 1690 }),
            }),
        ]);
    });
    it('refuses a Guest without saving anything', async () => {
        const current = library();

        const result = subject(current).execute(guest, input(), false);

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.books.books.size).toBe(0);
        expect(current.authors.authors.size).toBe(0);
    });
    it('rejects an invalid ISBN', async () => {
        const current = library();

        const result = subject(current).execute(owner, input({ isbn: '123' }), false);

        await expect(result).rejects.toMatchObject({ reason: 'isbn-invalid' });
    });
    it('rejects a publication month without a year', async () => {
        const current = library();

        const result = subject(current).execute(owner, input({ publicationMonth: 3 }), false);

        await expect(result).rejects.toMatchObject({ reason: 'publication-month-without-year' });
    });
    it('records the collection membership chosen in the form', async () => {
        const current = library();
        const membership = { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 3 };

        const result = await subject(current).execute(
            owner,
            input({ collection: membership }),
            false,
        );

        expect(result.collection).toEqual({
            id: 'collection-Batman',
            name: 'Batman',
            volumeFrom: 1,
            volumeTo: 3,
        });
        expect(current.trail.entries[0]).toMatchObject({
            category: 'book.created',
            after: { collection: { name: 'Batman', volumeFrom: 1, volumeTo: 3 } },
        });
    });
    it('deletes the planned books a purchased book replaces, with their covers', async () => {
        const current = library();
        const planned = await saved(current, { isbn: null, noIsbn: true, ownership: 'not-owned' });
        const file = await current.covers.store(new Uint8Array([1]), 'image/png');
        const stored = current.books.books.get(planned.id)!;

        stored.replaceCover(file, '2026-03-01T10:00:00.000Z');

        const result = await subject(current).execute(
            owner,
            input({
                collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
                replacePlanned: [planned.id],
            }),
            false,
        );

        expect(current.books.books.has(planned.id)).toBe(false);
        expect(current.books.books.has(result.id)).toBe(true);
        expect(current.covers.files.has(file)).toBe(false);
        expect(current.collections.replaced.at(-1)).toEqual([planned.id]);
        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.created',
            after: { replacedPlanned: [{ title: 'Piranesi', ownership: 'not-owned' }] },
        });
    });
    it('keeps the planned books when the purchased book cannot be saved', async () => {
        const current = library();
        const planned = await saved(current, { isbn: null, noIsbn: true, ownership: 'not-owned' });

        const result = subject(current).execute(
            owner,
            input({ title: '', replacePlanned: [planned.id] }),
            false,
        );

        await expect(result).rejects.toMatchObject({ reason: 'title-invalid' });
        expect(current.books.books.has(planned.id)).toBe(true);
    });
    it('records the collection it created in the same operation', async () => {
        const current = library();

        current.collections.changes = [
            {
                category: 'collection.created',
                subjectType: 'collection',
                subjectId: 'collection-Batman',
                before: null,
                after: { name: 'Batman', includesVolumeZero: false, finished: false },
            },
        ];

        await subject(current).execute(
            owner,
            input({ collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 } }),
            false,
        );

        expect(current.trail.entries).toEqual([
            expect.objectContaining({ operationId: 'operation-1', category: 'book.created' }),
            expect.objectContaining({ operationId: 'operation-1', category: 'collection.created' }),
        ]);
    });
    it('keeps the book on the chosen shelf with its tags', async () => {
        const current = library();

        const result = await subject(current).execute(
            owner,
            input({ shelfId: 'shelf-3', tags: [{ name: 'Fantasy' }] }),
            false,
        );

        expect(result.location?.shelfName).toBe('Shelf 3');
        expect(result.tags).toEqual([{ id: 'tag-Fantasy', name: 'Fantasy' }]);
        expect(current.trail.entries[0]).toMatchObject({
            category: 'book.created',
            after: { location: { shelfId: 'shelf-3' }, tags: [{ name: 'Fantasy' }] },
        });
    });
    it('records the tags it created in the same operation', async () => {
        const current = library();

        await subject(current).execute(owner, input({ tags: [{ name: 'Fantasy' }] }), false);

        expect(current.trail.entries).toEqual([
            expect.objectContaining({ operationId: 'operation-1', category: 'book.created' }),
            expect.objectContaining({ operationId: 'operation-1', category: 'tag.created' }),
        ]);
    });
    it('saves nothing when the shelf does not exist', async () => {
        const current = library();

        const result = subject(current).execute(owner, input({ shelfId: 'unknown' }), false);

        await expect(result).rejects.toMatchObject({ reason: 'shelf-missing' });
        expect(current.trail.entries).toEqual([expect.objectContaining({ outcome: 'failed' })]);
    });
});
