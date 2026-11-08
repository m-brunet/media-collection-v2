import { describe, expect, it } from 'vitest';
import { guest, LocationDoubles, owner } from '../testing/location-doubles.test-support.js';
import { DeleteBookcase } from './delete-bookcase.usecase.js';

function subject(current: ReturnType<typeof LocationDoubles.furniture>) {
    return new DeleteBookcase(
        current.bookcases,
        current.loader,
        current.overview,
        current.operations,
    );
}

describe('DeleteBookcase', () => {
    it('removes the bookcase and its shelves, unassigning their books', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase, shelf } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        await LocationDoubles.placed(current, 'dune', shelf.id);

        await subject(current).execute(owner, bookcase.id);

        expect(current.bookcases.bookcases.size).toBe(0);
        expect(current.shelves.shelves.size).toBe(0);
        expect(current.store.shelves.has('dune')).toBe(false);
    });
    it('records its shelves and the number of unassigned books', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase, shelf } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        await LocationDoubles.withShelf(current, 'Oak', 'Bottom');
        await LocationDoubles.placed(current, 'dune', shelf.id);

        await subject(current).execute(owner, bookcase.id);

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'bookcase.deleted',
            before: { name: 'Oak', shelves: ['Bottom', 'Top'], unassignedBooks: 1 },
            after: null,
        });
    });
    it('reports an unknown bookcase', async () => {
        const current = LocationDoubles.furniture();

        const result = subject(current).execute(owner, 'unknown');

        await expect(result).rejects.toMatchObject({ reason: 'bookcase-missing' });
    });
    it('refuses a Guest and keeps the bookcase', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        const result = subject(current).execute(guest, bookcase.id);

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.bookcases.bookcases.size).toBe(1);
    });
});
