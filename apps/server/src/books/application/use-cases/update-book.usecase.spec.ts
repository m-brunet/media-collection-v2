import { describe, expect, it } from 'vitest';
import { guest, input, library, owner, saved } from '../testing/book-doubles.test-support.js';
import { UpdateBook } from './update-book.usecase.js';

function subject(current: ReturnType<typeof library>) {
    return new UpdateBook(
        current.books,
        current.authors,
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
});
