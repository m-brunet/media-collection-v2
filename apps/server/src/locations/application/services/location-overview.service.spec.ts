import { describe, expect, it } from 'vitest';
import { furniture, placed, withShelf } from '../testing/location-doubles.test-support.js';

describe('LocationOverview', () => {
    it('lists every bookcase with its shelves and book counts', async () => {
        const current = furniture();
        const { shelf } = await withShelf(current, 'Study', 'Top');

        await withShelf(current, 'Hall', 'Bottom');
        await placed(current, 'dune', shelf.id);

        const result = await current.overview.all();

        expect(result.map((bookcase) => [bookcase.name, bookcase.bookCount])).toEqual([
            ['Hall', 0],
            ['Study', 1],
        ]);
    });
    it('keeps empty bookcases', async () => {
        const current = furniture();
        const { bookcase } = await withShelf(current, 'Oak', null);

        const result = await current.overview.bookcase(bookcase);

        expect(result).toEqual({ id: bookcase.id, name: 'Oak', bookCount: 0, shelves: [] });
    });
    it('counts the books on a shelf', async () => {
        const current = furniture();
        const { shelf } = await withShelf(current, 'Oak', 'Top');

        await placed(current, 'dune', shelf.id);
        await placed(current, 'piranesi', shelf.id);

        const result = await current.overview.shelf(shelf);

        expect(result.bookCount).toBe(2);
    });
});
