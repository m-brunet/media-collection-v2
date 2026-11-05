import { describe, expect, it } from 'vitest';
import {
    furniture,
    guest,
    owner,
    placed,
    withShelf,
} from '../testing/location-doubles.test-support.js';
import { ChangeShelf } from './change-shelf.usecase.js';

function subject(current: ReturnType<typeof furniture>) {
    return new ChangeShelf(
        current.shelves,
        current.loader,
        current.naming,
        current.overview,
        current.clock,
        current.operations,
    );
}

describe('ChangeShelf', () => {
    it('renames a shelf, keeping its books', async () => {
        const current = furniture();
        const { shelf } = await withShelf(current, 'Oak', 'Shelf 3');

        await placed(current, 'dune', shelf.id);

        const result = await subject(current).execute(owner, shelf.id, { name: 'Top' });

        expect(result).toMatchObject({ name: 'Top', bookCount: 1 });
        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'shelf.renamed',
            before: { name: 'Shelf 3' },
            after: { name: 'Top' },
        });
    });
    it('moves a shelf with its books to another bookcase', async () => {
        const current = furniture();
        const { shelf } = await withShelf(current, 'Oak', 'Top');
        const { bookcase: study } = await withShelf(current, 'Study', null);

        await placed(current, 'dune', shelf.id);

        const result = await subject(current).execute(owner, shelf.id, { bookcaseId: study.id });

        expect(result).toMatchObject({ bookcaseId: study.id, bookCount: 1 });
        expect(current.store.shelves.get('dune')).toBe(shelf.id);
        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'shelf.moved',
            before: { bookcaseName: 'Oak' },
            after: { bookcaseName: 'Study' },
        });
    });
    it('refuses a move into a bookcase with an equivalent shelf name', async () => {
        const current = furniture();
        const { shelf } = await withShelf(current, 'Oak', 'Top');
        const { bookcase: study } = await withShelf(current, 'Study', 'TOP');

        const result = subject(current).execute(owner, shelf.id, { bookcaseId: study.id });

        await expect(result).rejects.toMatchObject({ reason: 'shelf-name-taken' });
        expect(current.shelves.shelves.get(shelf.id)?.snapshot.bookcaseId).toBe(
            shelf.snapshot.bookcaseId,
        );
    });
    it('refuses the name of another shelf in the same bookcase', async () => {
        const current = furniture();
        const { shelf } = await withShelf(current, 'Oak', 'Top');

        await withShelf(current, 'Oak', 'Bottom');

        const result = subject(current).execute(owner, shelf.id, { name: 'bottom' });

        await expect(result).rejects.toMatchObject({ reason: 'shelf-name-taken' });
    });
    it('reports an unknown destination bookcase', async () => {
        const current = furniture();
        const { shelf } = await withShelf(current, 'Oak', 'Top');

        const result = subject(current).execute(owner, shelf.id, { bookcaseId: 'unknown' });

        await expect(result).rejects.toMatchObject({ reason: 'bookcase-missing' });
    });
    it('reports an unknown shelf', async () => {
        const current = furniture();

        const result = subject(current).execute(owner, 'unknown', { name: 'Top' });

        await expect(result).rejects.toMatchObject({ reason: 'shelf-missing' });
    });
    it('refuses a Guest', async () => {
        const current = furniture();
        const { shelf } = await withShelf(current, 'Oak', 'Top');

        const result = subject(current).execute(guest, shelf.id, { name: 'Bottom' });

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
    });
});
