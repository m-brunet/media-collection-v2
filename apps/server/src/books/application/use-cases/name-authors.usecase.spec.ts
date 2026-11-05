import { describe, expect, it } from 'vitest';
import { guest, library, saved } from '../testing/book-doubles.test-support.js';
import { NameAuthors } from './name-authors.usecase.js';

describe('NameAuthors', () => {
    it('names the chosen authors in name order', async () => {
        const current = library();
        const book = await saved(current, {
            authors: [{ name: 'Terry Pratchett' }, { name: 'Neil Gaiman' }],
        });
        const ids = book.authors.map((author) => author.id);

        const result = await new NameAuthors(current.authors).execute(guest, ids);

        expect(result.map((author) => author.name)).toEqual(['Neil Gaiman', 'Terry Pratchett']);
    });
    it('leaves out an unknown author', async () => {
        const current = library();

        const result = await new NameAuthors(current.authors).execute(guest, ['removed']);

        expect(result).toEqual([]);
    });
});
