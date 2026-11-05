import { describe, expect, it } from 'vitest';
import { furniture, withShelf } from '../testing/location-doubles.test-support.js';

describe('LocationLoader', () => {
    it('loads a saved bookcase', async () => {
        const current = furniture();
        const { bookcase } = await withShelf(current, 'Oak', 'Top');

        const result = await current.loader.bookcase(bookcase.id);

        expect(result.snapshot.name).toBe('Oak');
    });
    it('reports an unknown bookcase', async () => {
        const current = furniture();

        const result = current.loader.bookcase('unknown');

        await expect(result).rejects.toMatchObject({
            code: 'not_found',
            reason: 'bookcase-missing',
        });
    });
    it('loads a saved shelf', async () => {
        const current = furniture();
        const { shelf } = await withShelf(current, 'Oak', 'Top');

        const result = await current.loader.shelf(shelf.id);

        expect(result.snapshot.name).toBe('Top');
    });
    it('reports an unknown shelf', async () => {
        const current = furniture();

        const result = current.loader.shelf('unknown');

        await expect(result).rejects.toMatchObject({ code: 'not_found', reason: 'shelf-missing' });
    });
});
