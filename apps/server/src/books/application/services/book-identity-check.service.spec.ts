import { describe, expect, it } from 'vitest';
import { BookDoubles } from '../testing/book-doubles.test-support.js';

const noIsbn = { isbn: null, noIsbn: true };

describe('BookIdentityCheck', () => {
    it('accepts an ISBN no other book has', async () => {
        const current = BookDoubles.library();
        const details = await current.builder.build(BookDoubles.input());

        const result = current.identity.ensureUnique(details, 'new', false);

        await expect(result).resolves.toBeUndefined();
    });
    it('refuses an ISBN another book has', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);
        const details = await current.builder.build(BookDoubles.input());

        const result = current.identity.ensureUnique(details, 'new', false);

        await expect(result).rejects.toMatchObject({
            reason: 'isbn-taken',
            details: { bookId: book.id },
        });
    });
    it('accepts the ISBN of the book being edited', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);
        const details = await current.builder.build(BookDoubles.input());

        const result = current.identity.ensureUnique(details, book.id, false);

        await expect(result).resolves.toBeUndefined();
    });
    it('flags a no-ISBN book with a similar title and a shared author', async () => {
        const current = BookDoubles.library();

        await BookDoubles.saved(current, noIsbn);
        const details = await current.builder.build(
            BookDoubles.input({ ...noIsbn, title: 'Piranessi' }),
        );

        const result = current.identity.ensureUnique(details, 'new', false);

        await expect(result).rejects.toMatchObject({ reason: 'possible-duplicate' });
    });
    it('accepts the same title by different authors', async () => {
        const current = BookDoubles.library();

        await BookDoubles.saved(current, noIsbn);
        const details = await current.builder.build(
            BookDoubles.input({ ...noIsbn, authors: [{ name: 'Someone Else' }] }),
        );

        const result = current.identity.ensureUnique(details, 'new', false);

        await expect(result).resolves.toBeUndefined();
    });
    it('accepts a possible duplicate once confirmed', async () => {
        const current = BookDoubles.library();

        await BookDoubles.saved(current, noIsbn);
        const details = await current.builder.build(BookDoubles.input(noIsbn));

        const result = current.identity.ensureUnique(details, 'new', true);

        await expect(result).resolves.toBeUndefined();
    });
});
