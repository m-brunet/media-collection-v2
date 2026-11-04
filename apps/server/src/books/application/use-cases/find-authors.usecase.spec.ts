import { describe, expect, it } from 'vitest';
import { guest, library, saved } from '../testing/book-doubles.test-support.js';
import { FindAuthors } from './find-authors.usecase.js';

describe('FindAuthors', () => {
    it('finds authors whose name contains the search, ignoring accents', async () => {
        const current = library();

        await saved(current, { authors: [{ name: 'Hervé Bazin' }] });

        const result = await new FindAuthors(current.authors).execute(guest, 'herve');

        expect(result).toEqual([{ id: expect.any(String), name: 'Hervé Bazin' }]);
    });
    it('finds nothing for an empty search', async () => {
        const current = library();

        await saved(current);

        const result = await new FindAuthors(current.authors).execute(guest, '  ');

        expect(result).toEqual([]);
    });
});
