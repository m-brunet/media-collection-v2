import { describe, expect, it } from 'vitest';
import {
    furniture,
    guest,
    owner,
    placed,
    withShelf,
} from '../testing/location-doubles.test-support.js';
import { DeleteBookcase } from './delete-bookcase.usecase.js';

function subject(current: ReturnType<typeof furniture>) {
    return new DeleteBookcase(
        current.bookcases,
        current.loader,
        current.overview,
        current.operations,
    );
}

describe('DeleteBookcase', () => {
    it('removes the bookcase and its shelves, unassigning their books', async () => {
        const current = furniture();
        const { bookcase, shelf } = await withShelf(current, 'Oak', 'Top');

        await placed(current, 'dune', shelf.id);

        await subject(current).execute(owner, bookcase.id);

        expect(current.bookcases.bookcases.size).toBe(0);
        expect(current.shelves.shelves.size).toBe(0);
        expect(current.store.shelves.has('dune')).toBe(false);
    });
    it('records its shelves and the number of unassigned books', async () => {
        const current = furniture();
        const { bookcase, shelf } = await withShelf(current, 'Oak', 'Top');

        await withShelf(current, 'Oak', 'Bottom');
        await placed(current, 'dune', shelf.id);

        await subject(current).execute(owner, bookcase.id);

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'bookcase.deleted',
            before: { name: 'Oak', shelves: ['Bottom', 'Top'], unassignedBooks: 1 },
            after: null,
        });
    });
    it('reports an unknown bookcase', async () => {
        const current = furniture();

        const result = subject(current).execute(owner, 'unknown');

        await expect(result).rejects.toMatchObject({ reason: 'bookcase-missing' });
    });
    it('refuses a Guest and keeps the bookcase', async () => {
        const current = furniture();
        const { bookcase } = await withShelf(current, 'Oak', 'Top');

        const result = subject(current).execute(guest, bookcase.id);

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.bookcases.bookcases.size).toBe(1);
    });
});
