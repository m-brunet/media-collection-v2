import { describe, expect, it } from 'vitest';
import { LocationDoubles } from '../testing/location-doubles.test-support.js';

describe('LocationLoader', () => {
    it('loads a saved bookcase', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        const result = await current.loader.bookcase(bookcase.id);

        expect(result.snapshot.name).toBe('Oak');
    });
    it('reports an unknown bookcase', async () => {
        const current = LocationDoubles.furniture();

        const result = current.loader.bookcase('unknown');

        await expect(result).rejects.toMatchObject({
            code: 'not_found',
            reason: 'bookcase-missing',
        });
    });
    it('loads a saved shelf', async () => {
        const current = LocationDoubles.furniture();
        const { shelf } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        const result = await current.loader.shelf(shelf.id);

        expect(result.snapshot.name).toBe('Top');
    });
    it('reports an unknown shelf', async () => {
        const current = LocationDoubles.furniture();

        const result = current.loader.shelf('unknown');

        await expect(result).rejects.toMatchObject({ code: 'not_found', reason: 'shelf-missing' });
    });
});
