import { describe, expect, it } from 'vitest';
import { guest, library, owner, saved } from '../testing/book-doubles.test-support.js';
import { CorrectAuthor } from './correct-author.usecase.js';

describe('CorrectAuthor', () => {
    it('corrects the shared spelling on every linked book', async () => {
        const current = library();
        const book = await saved(current, { authors: [{ name: 'Susana Clarke' }] });
        const authorId = book.authors[0]!.id;

        const result = await new CorrectAuthor(current.authors, current.operations).execute(
            owner,
            authorId,
            'Susanna Clarke',
        );

        expect(result).toEqual({ id: authorId, name: 'Susanna Clarke' });
        expect((await current.catalog.authorsOf(book.id))[0]!.name).toBe('Susanna Clarke');
    });
    it('allows correcting only the letter case or accents of the same author', async () => {
        const current = library();
        const book = await saved(current, { authors: [{ name: 'herve bazin' }] });

        const result = new CorrectAuthor(current.authors, current.operations).execute(
            owner,
            book.authors[0]!.id,
            'Hervé Bazin',
        );

        await expect(result).resolves.toMatchObject({ name: 'Hervé Bazin' });
    });
    it('refuses a name equivalent to another author', async () => {
        const current = library();
        const book = await saved(current, { authors: [{ name: 'Susana Clarke' }] });

        await saved(current, {
            isbn: '9780306406157',
            authors: [{ name: 'Susanna Clarke', distinct: true }],
        });

        const result = new CorrectAuthor(current.authors, current.operations).execute(
            owner,
            book.authors[0]!.id,
            'susanna clarke',
        );

        await expect(result).rejects.toMatchObject({ reason: 'author-name-taken' });
    });
    it('records the previous and corrected spelling', async () => {
        const current = library();
        const book = await saved(current, { authors: [{ name: 'Susana Clarke' }] });

        await new CorrectAuthor(current.authors, current.operations).execute(
            owner,
            book.authors[0]!.id,
            'Susanna Clarke',
        );

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'author.corrected',
            before: { name: 'Susana Clarke' },
            after: { name: 'Susanna Clarke' },
        });
    });
    it('refuses a Guest', async () => {
        const current = library();
        const book = await saved(current);

        const result = new CorrectAuthor(current.authors, current.operations).execute(
            guest,
            book.authors[0]!.id,
            'Someone',
        );

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
    });
});
