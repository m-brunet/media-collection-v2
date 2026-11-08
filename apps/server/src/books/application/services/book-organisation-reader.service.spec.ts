import { describe, expect, it } from 'vitest';
import { BookDoubles } from '../testing/book-doubles.test-support.js';

describe('BookOrganisationReader', () => {
    it('reads the location and tags of a book', async () => {
        const current = BookDoubles.library();

        await current.organiser.apply('dune', { shelfId: 'top', tags: [{ id: 'history' }] });

        const result = await current.organisation.current('dune');

        expect(result).toEqual({
            location: {
                bookcaseId: 'study',
                bookcaseName: 'Study',
                shelfId: 'top',
                shelfName: 'Top',
            },
            tags: [{ id: 'history', name: 'History' }],
        });
    });
    it('reads an unorganised book as unassigned and untagged', async () => {
        const current = BookDoubles.library();

        const result = await current.organisation.current('dune');

        expect(result).toEqual({ location: null, tags: [] });
    });
});
