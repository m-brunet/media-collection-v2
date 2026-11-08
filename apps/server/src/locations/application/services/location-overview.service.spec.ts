import { describe, expect, it } from 'vitest';
import { LocationDoubles } from '../testing/location-doubles.test-support.js';

describe('LocationOverview', () => {
    it('lists every bookcase with its shelves and book counts', async () => {
        const current = LocationDoubles.furniture();
        const { shelf } = await LocationDoubles.withShelf(current, 'Study', 'Top');

        await LocationDoubles.withShelf(current, 'Hall', 'Bottom');
        await LocationDoubles.placed(current, 'dune', shelf.id);

        const result = await current.overview.all();

        expect(result.map((bookcase) => [bookcase.name, bookcase.bookCount])).toEqual([
            ['Hall', 0],
            ['Study', 1],
        ]);
    });
    it('keeps empty bookcases', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', null);

        const result = await current.overview.bookcase(bookcase);

        expect(result).toEqual({ id: bookcase.id, name: 'Oak', bookCount: 0, shelves: [] });
    });
    it('counts the books on a shelf', async () => {
        const current = LocationDoubles.furniture();
        const { shelf } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        await LocationDoubles.placed(current, 'dune', shelf.id);
        await LocationDoubles.placed(current, 'piranesi', shelf.id);

        const result = await current.overview.shelf(shelf);

        expect(result.bookCount).toBe(2);
    });
});
