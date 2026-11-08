import { describe, expect, it } from 'vitest';
import { guest, LocationDoubles, owner } from '../testing/location-doubles.test-support.js';
import { DeleteShelf } from './delete-shelf.usecase.js';

function subject(current: ReturnType<typeof LocationDoubles.furniture>) {
    return new DeleteShelf(current.shelves, current.loader, current.overview, current.operations);
}

describe('DeleteShelf', () => {
    it('removes the shelf and unassigns its books, keeping its bookcase', async () => {
        const current = LocationDoubles.furniture();
        const { shelf } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        await LocationDoubles.placed(current, 'dune', shelf.id);

        await subject(current).execute(owner, shelf.id);

        expect(current.shelves.shelves.size).toBe(0);
        expect(current.bookcases.bookcases.size).toBe(1);
        expect(current.store.shelves.has('dune')).toBe(false);
    });
    it('records the number of unassigned books', async () => {
        const current = LocationDoubles.furniture();
        const { shelf } = await LocationDoubles.withShelf(current, 'Oak', 'Shelf 3');

        await LocationDoubles.placed(current, 'dune', shelf.id);
        await LocationDoubles.placed(current, 'piranesi', shelf.id);

        await subject(current).execute(owner, shelf.id);

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'shelf.deleted',
            before: { name: 'Shelf 3', bookcaseName: 'Oak', unassignedBooks: 2 },
            after: null,
        });
    });
    it('reports an unknown shelf', async () => {
        const current = LocationDoubles.furniture();

        const result = subject(current).execute(owner, 'unknown');

        await expect(result).rejects.toMatchObject({ reason: 'shelf-missing' });
    });
    it('refuses a Guest and keeps the shelf', async () => {
        const current = LocationDoubles.furniture();
        const { shelf } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        const result = subject(current).execute(guest, shelf.id);

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.shelves.shelves.size).toBe(1);
    });
});
