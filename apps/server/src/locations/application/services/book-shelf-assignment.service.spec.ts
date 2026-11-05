import { describe, expect, it } from 'vitest';
import { furniture, withShelf } from '../testing/location-doubles.test-support.js';

describe('BookShelfAssignment', () => {
    it('places a book on a shelf, with its bookcase', async () => {
        const current = furniture();
        const { bookcase, shelf } = await withShelf(current, 'Oak bookcase', 'Shelf 3');

        const result = await current.assignment.assign('dune', shelf.id);

        expect(result).toEqual({
            bookcaseId: bookcase.id,
            bookcaseName: 'Oak bookcase',
            shelfId: shelf.id,
            shelfName: 'Shelf 3',
        });
        expect(current.store.shelves.get('dune')).toBe(shelf.id);
    });
    it('moves a book to another shelf', async () => {
        const current = furniture();
        const { shelf: top } = await withShelf(current, 'Oak', 'Top');
        const { shelf: bottom } = await withShelf(current, 'Study', 'Bottom');

        await current.assignment.assign('dune', top.id);

        await current.assignment.assign('dune', bottom.id);

        expect(current.store.shelves.get('dune')).toBe(bottom.id);
    });
    it('leaves a book unassigned', async () => {
        const current = furniture();
        const { shelf } = await withShelf(current, 'Oak', 'Top');

        await current.assignment.assign('dune', shelf.id);

        const result = await current.assignment.assign('dune', null);

        expect(result).toBeNull();
        expect(current.store.shelves.has('dune')).toBe(false);
    });
    it('refuses an unknown shelf without changing the book', async () => {
        const current = furniture();

        const result = current.assignment.assign('dune', 'unknown');

        await expect(result).rejects.toMatchObject({ reason: 'shelf-missing' });
        expect(current.store.shelves.has('dune')).toBe(false);
    });
    it('describes where a book is kept', async () => {
        const current = furniture();
        const { shelf } = await withShelf(current, 'Oak', 'Top');

        await current.assignment.assign('dune', shelf.id);

        const result = await current.assignment.of('dune');

        expect(result).toMatchObject({ bookcaseName: 'Oak', shelfName: 'Top' });
    });
    it('describes an unassigned book', async () => {
        const current = furniture();

        const result = await current.assignment.of('dune');

        expect(result).toBeNull();
    });
});
