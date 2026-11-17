import { describe, expect, it } from 'vitest';
import { BookDoubles, guest } from '../testing/book-doubles.test-support.js';
import { FindPublishers } from './find-publishers.usecase.js';

describe('FindPublishers', () => {
    it('suggests the existing publishers matching the search, ignoring accents', async () => {
        const current = BookDoubles.library();

        await BookDoubles.saved(current, { publisher: 'Glénat' });

        const result = await new FindPublishers(current.publishers).execute(guest, 'glen');

        expect(result).toEqual(['Glénat']);
    });
    it('suggests nothing for an empty search', async () => {
        const current = BookDoubles.library();

        await BookDoubles.saved(current, { publisher: 'Glénat' });

        const result = await new FindPublishers(current.publishers).execute(guest, '');

        expect(result).toEqual([]);
    });
});
