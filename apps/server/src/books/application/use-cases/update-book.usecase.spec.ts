import { describe, expect, it } from 'vitest';
import { BookDoubles, guest, owner } from '../testing/book-doubles.test-support.js';
import { UpdateBook } from './update-book.usecase.js';

function subject(current: ReturnType<typeof BookDoubles.library>) {
    return new UpdateBook(
        current.books,
        current.authors,
        current.collections,
        current.collections,
        current.removal,
        current.organiser,
        current.covers,
        current.loader,
        current.builder,
        current.identity,
        current.titles,
        current.guard,
        current.viewer,
        current.clock,
        current.operations,
    );
}

describe('UpdateBook', () => {
    it('saves the corrected information', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ title: 'Piranesi (paperback)', pageCount: 272 }),
        );

        expect(result).toMatchObject({ title: 'Piranesi (paperback)', pageCount: 272 });
    });
    it('removes an author no other book uses any more', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ authors: [{ name: 'Neil Gaiman' }] }),
        );

        expect([...current.authors.authors.values()].map((author) => author.snapshot.name)).toEqual(
            ['Neil Gaiman'],
        );
    });
    it('keeps an author another book still uses', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        await BookDoubles.saved(current, { isbn: '9780306406157', title: 'Jonathan Strange' });

        await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ authors: [{ name: 'Neil Gaiman' }] }),
        );

        expect(current.authors.authors.size).toBe(2);
    });
    it('refuses an ISBN that belongs to another book', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        await BookDoubles.saved(current, { isbn: '9780306406157', title: 'Other' });

        const result = subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ isbn: '9780306406157' }),
        );

        await expect(result).rejects.toMatchObject({ reason: 'isbn-taken' });
    });
    it('keeps its own ISBN', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ summary: 'Halls.' }),
        );

        await expect(result).resolves.toMatchObject({ summary: 'Halls.' });
    });
    it('records the before and after information', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ ownership: 'not-owned' }),
        );

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.updated',
            before: expect.objectContaining({ ownership: 'owned' }),
            after: expect.objectContaining({ ownership: 'not-owned' }),
        });
    });
    it('reports a missing book', async () => {
        const current = BookDoubles.library();

        const result = subject(current).execute(owner, 'missing', BookDoubles.input());

        await expect(result).rejects.toMatchObject({ code: 'not_found', reason: 'book-missing' });
    });
    it('refuses a Guest', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = subject(current).execute(
            guest,
            book.id,
            BookDoubles.input({ title: 'Changed' }),
        );

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.books.books.get(book.id)!.details.title).toBe('Piranesi');
    });
    it('moves the book to another collection', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, {
            collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
        });

        const result = await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({
                collection: { collection: { name: 'Superman' }, volumeFrom: 2, volumeTo: 2 },
            }),
        );

        expect(result.collection).toMatchObject({ name: 'Superman', volumeFrom: 2 });
        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.updated',
            before: { collection: { name: 'Batman' } },
            after: { collection: { name: 'Superman' } },
        });
    });
    it('refuses a new category while the book stays in a collection of another category', async () => {
        const current = BookDoubles.library();
        const membership = { collection: { name: 'Naruto' }, volumeFrom: 1, volumeTo: 1 };
        const book = await BookDoubles.saved(current, {
            category: 'manga',
            collection: membership,
        });

        const result = subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ category: 'comics', collection: membership }),
        );

        await expect(result).rejects.toMatchObject({
            reason: 'collection-category-mismatch',
            details: { name: 'Naruto', category: 'manga', bookCategory: 'comics' },
        });
    });
    it('deletes the planned books the edited Owned book replaces', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);
        const planned = await BookDoubles.saved(current, {
            title: 'Planned',
            isbn: null,
            noIsbn: true,
            ownership: 'not-owned',
        });

        await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({
                collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
                replacePlanned: [planned.id],
            }),
        );

        expect(current.books.books.has(planned.id)).toBe(false);
        expect(current.collections.replaced.at(-1)).toEqual([planned.id]);
    });
    it('records the collection changes in the same operation', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

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
            book.id,
            BookDoubles.input({
                collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
            }),
        );

        expect(current.trail.entries.slice(-2)).toEqual([
            expect.objectContaining({ operationId: 'operation-2', category: 'book.updated' }),
            expect.objectContaining({ operationId: 'operation-2', category: 'collection.created' }),
        ]);
    });
    it('records the location and tags before and after the change', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, {
            shelfId: 'top',
            tags: [{ name: 'Fantasy' }],
        });

        await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ shelfId: 'shelf-3', tags: [] }),
        );

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.updated',
            before: { location: { shelfId: 'top' }, tags: [{ name: 'Fantasy' }] },
            after: { location: { shelfId: 'shelf-3' }, tags: [] },
        });
    });
});

describe('UpdateBook with loans', () => {
    it('refuses to change a lent book to Not Owned and keeps it Owned', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        current.loans.lend(book.id, 'Sam Taylor');

        const result = subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ ownership: 'not-owned' }),
        );

        await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'book-lent' });
        expect(current.books.books.get(book.id)!.details.ownership).toBe('owned');
    });
    it('saves other changes of a lent book', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        current.loans.lend(book.id);

        const result = await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ title: 'Piranesi (2nd)' }),
        );

        expect(result).toMatchObject({ title: 'Piranesi (2nd)', ownership: 'owned' });
        expect(result.loan).not.toBeNull();
    });
});

describe('UpdateBook titles', () => {
    const gunnm = { collection: { name: 'Gunnm' }, volumeFrom: 3, volumeTo: 3 };
    const generated = { title: '', category: 'manga' as const, collection: gunnm };

    it('keeps generation through an unrelated edit (example 3)', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, generated);

        const result = await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ ...generated, pageCount: 200 }),
        );

        expect(result).toMatchObject({
            title: 'Gunnm Vol. 3',
            titleGenerated: true,
            pageCount: 200,
        });
    });
    it('regenerates the title when the coverage changes (example 3)', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, generated);

        const result = await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({
                ...generated,
                collection: { ...gunnm, volumeFrom: 3, volumeTo: 4 },
            }),
        );

        expect(result.title).toBe('Gunnm Vol. 3–4');
    });
    it('regenerates the title when the book moves to another collection (example 3)', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, generated);

        const result = await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({
                ...generated,
                collection: { ...gunnm, collection: { name: 'Alita' } },
            }),
        );

        expect(result.title).toBe('Alita Vol. 3');
    });
    it('turns a typed title into a supplied one, even when identical to the generated one', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, generated);

        const result = await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ ...generated, title: 'Gunnm Vol. 3' }),
        );

        expect(result).toMatchObject({ title: 'Gunnm Vol. 3', titleGenerated: false });
    });
    it('requires a title when the book leaves its collection (example 4)', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, generated);

        const result = subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ ...generated, collection: null }),
        );

        await expect(result).rejects.toMatchObject({ reason: 'title-required' });
        expect(current.books.books.get(book.id)!.details.titleGenerated).toBe(true);
    });
    it('requires a title when the book becomes a Books record (example 4)', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, generated);

        const result = subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ ...generated, category: 'books' }),
        );

        await expect(result).rejects.toMatchObject({ reason: 'title-required' });
    });
    it('saves the last generated title as supplied when the person accepts it (example 4)', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current, generated);

        const result = await subject(current).execute(
            owner,
            book.id,
            BookDoubles.input({ ...generated, title: 'Gunnm Vol. 3', collection: null }),
        );

        expect(result).toMatchObject({ title: 'Gunnm Vol. 3', titleGenerated: false });
    });
});
