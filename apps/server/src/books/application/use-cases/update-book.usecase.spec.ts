import { describe, expect, it } from 'vitest';
import { guest, input, library, owner, saved } from '../testing/book-doubles.test-support.js';
import { UpdateBook } from './update-book.usecase.js';

function subject(current: ReturnType<typeof library>) {
    return new UpdateBook(
        current.books,
        current.authors,
        current.collections,
        current.collections,
        current.removal,
        current.covers,
        current.loader,
        current.builder,
        current.identity,
        current.viewer,
        current.clock,
        current.operations,
    );
}

describe('UpdateBook', () => {
    it('saves the corrected information', async () => {
        const current = library();
        const book = await saved(current);

        const result = await subject(current).execute(
            owner,
            book.id,
            input({ title: 'Piranesi (paperback)', pageCount: 272 }),
        );

        expect(result).toMatchObject({ title: 'Piranesi (paperback)', pageCount: 272 });
    });
    it('removes an author no other book uses any more', async () => {
        const current = library();
        const book = await saved(current);

        await subject(current).execute(
            owner,
            book.id,
            input({ authors: [{ name: 'Neil Gaiman' }] }),
        );

        expect([...current.authors.authors.values()].map((author) => author.snapshot.name)).toEqual(
            ['Neil Gaiman'],
        );
    });
    it('keeps an author another book still uses', async () => {
        const current = library();
        const book = await saved(current);

        await saved(current, { isbn: '9780306406157', title: 'Jonathan Strange' });

        await subject(current).execute(
            owner,
            book.id,
            input({ authors: [{ name: 'Neil Gaiman' }] }),
        );

        expect(current.authors.authors.size).toBe(2);
    });
    it('refuses an ISBN that belongs to another book', async () => {
        const current = library();
        const book = await saved(current);

        await saved(current, { isbn: '9780306406157', title: 'Other' });

        const result = subject(current).execute(owner, book.id, input({ isbn: '9780306406157' }));

        await expect(result).rejects.toMatchObject({ reason: 'isbn-taken' });
    });
    it('keeps its own ISBN', async () => {
        const current = library();
        const book = await saved(current);

        const result = subject(current).execute(owner, book.id, input({ summary: 'Halls.' }));

        await expect(result).resolves.toMatchObject({ summary: 'Halls.' });
    });
    it('records the before and after information', async () => {
        const current = library();
        const book = await saved(current);

        await subject(current).execute(owner, book.id, input({ ownership: 'not-owned' }));

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.updated',
            before: expect.objectContaining({ ownership: 'owned' }),
            after: expect.objectContaining({ ownership: 'not-owned' }),
        });
    });
    it('reports a missing book', async () => {
        const current = library();

        const result = subject(current).execute(owner, 'missing', input());

        await expect(result).rejects.toMatchObject({ code: 'not_found', reason: 'book-missing' });
    });
    it('refuses a Guest', async () => {
        const current = library();
        const book = await saved(current);

        const result = subject(current).execute(guest, book.id, input({ title: 'Changed' }));

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.books.books.get(book.id)!.details.title).toBe('Piranesi');
    });
    it('moves the book to another collection', async () => {
        const current = library();
        const book = await saved(current, {
            collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
        });

        const result = await subject(current).execute(
            owner,
            book.id,
            input({ collection: { collection: { name: 'Superman' }, volumeFrom: 2, volumeTo: 2 } }),
        );

        expect(result.collection).toMatchObject({ name: 'Superman', volumeFrom: 2 });
        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.updated',
            before: { collection: { name: 'Batman' } },
            after: { collection: { name: 'Superman' } },
        });
    });
    it('deletes the planned books the edited Owned book replaces', async () => {
        const current = library();
        const book = await saved(current);
        const planned = await saved(current, {
            title: 'Planned',
            isbn: null,
            noIsbn: true,
            ownership: 'not-owned',
        });

        await subject(current).execute(
            owner,
            book.id,
            input({
                collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
                replacePlanned: [planned.id],
            }),
        );

        expect(current.books.books.has(planned.id)).toBe(false);
        expect(current.collections.replaced.at(-1)).toEqual([planned.id]);
    });
    it('records the collection changes in the same operation', async () => {
        const current = library();
        const book = await saved(current);

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
            input({ collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 } }),
        );

        expect(current.trail.entries.slice(-2)).toEqual([
            expect.objectContaining({ operationId: 'operation-2', category: 'book.updated' }),
            expect.objectContaining({ operationId: 'operation-2', category: 'collection.created' }),
        ]);
    });
});
