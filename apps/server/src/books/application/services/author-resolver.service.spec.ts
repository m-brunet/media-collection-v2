import { describe, expect, it } from 'vitest';
import { BookDoubles } from '../testing/book-doubles.test-support.js';
import { AuthorResolver } from './author-resolver.service.js';

function subject(current: ReturnType<typeof BookDoubles.library>) {
    return new AuthorResolver(current.authors, current.ids, current.clock);
}

describe('AuthorResolver', () => {
    it('keeps a chosen existing author', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = await subject(current).resolve([{ id: book.authors[0]!.id }]);

        expect(result).toEqual([book.authors[0]!.id]);
    });
    it('reports a chosen author that no longer exists', async () => {
        const current = BookDoubles.library();

        const result = subject(current).resolve([{ id: 'gone' }]);

        await expect(result).rejects.toMatchObject({ code: 'not_found', reason: 'author-missing' });
    });
    it('reuses an author with an equivalent name', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = await subject(current).resolve([{ name: 'SUSANNA CLARKE' }]);

        expect(result).toEqual([book.authors[0]!.id]);
    });
    it('creates a new author with the trimmed name', async () => {
        const current = BookDoubles.library();

        const [id] = await subject(current).resolve([{ name: '  Ursula K. Le Guin ' }]);

        expect(current.authors.authors.get(id!)!.snapshot.name).toBe('Ursula K. Le Guin');
    });
    it('offers similar authors instead of creating one', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);

        const result = subject(current).resolve([{ name: 'Susana Clarke' }]);

        await expect(result).rejects.toMatchObject({
            reason: 'author-similar',
            details: {
                name: 'Susana Clarke',
                candidates: [{ id: book.authors[0]!.id, name: 'Susanna Clarke' }],
            },
        });
    });
    it('creates a similar author confirmed as someone else', async () => {
        const current = BookDoubles.library();

        await BookDoubles.saved(current);

        await subject(current).resolve([{ name: 'Susana Clarke', distinct: true }]);

        expect(current.authors.authors.size).toBe(2);
    });
    it('matches chosen and equivalent authors with their names without creating one', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);
        const clarke = book.authors[0]!.id;

        const result = await subject(current).match([
            { name: 'SUSANNA CLARKE' },
            { id: clarke },
            { name: ' Ursula K. Le Guin ' },
        ]);

        expect(result).toEqual([
            { id: clarke, name: 'Susanna Clarke' },
            { id: clarke, name: 'Susanna Clarke' },
            { id: null, name: 'Ursula K. Le Guin' },
        ]);
        expect(current.authors.authors.size).toBe(1);
    });
    it('offers similar authors when matching names', async () => {
        const current = BookDoubles.library();

        await BookDoubles.saved(current);

        const result = subject(current).match([{ name: 'Susana Clarke' }]);

        await expect(result).rejects.toMatchObject({ reason: 'author-similar' });
    });
    it('matches a similar author confirmed as someone else as a new one', async () => {
        const current = BookDoubles.library();

        await BookDoubles.saved(current);

        const result = await subject(current).match([{ name: 'Susana Clarke', distinct: true }]);

        expect(result).toEqual([{ id: null, name: 'Susana Clarke' }]);
    });
    it('reports a matched author that no longer exists', async () => {
        const current = BookDoubles.library();

        const result = subject(current).match([{ id: 'gone' }]);

        await expect(result).rejects.toMatchObject({ code: 'not_found', reason: 'author-missing' });
    });
});
