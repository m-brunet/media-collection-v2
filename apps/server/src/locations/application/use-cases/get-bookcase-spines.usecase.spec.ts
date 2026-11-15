import { describe, expect, it } from 'vitest';
import { guest, LocationDoubles, owner } from '../testing/location-doubles.test-support.js';
import { GetBookcaseSpines } from './get-bookcase-spines.usecase.js';

function useCase(current: ReturnType<typeof LocationDoubles.furniture>) {
    return new GetBookcaseSpines(current.loader, current.shelves, current.viewer, current.spines);
}

const dune = {
    id: 'dune',
    title: 'Dune',
    authors: ['Frank Herbert'],
    category: 'books' as const,
    pageCount: 612,
};

describe('GetBookcaseSpines', () => {
    it('gives the books of every shelf, shelves in name order', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase, shelf: lower } = await LocationDoubles.withShelf(
            current,
            'Oak',
            'Shelf 2',
        );
        const { shelf: upper } = await LocationDoubles.withShelf(current, 'Oak', 'Shelf 1');

        current.spines.books.set(lower.id, [dune]);

        const result = await useCase(current).execute(guest, bookcase.id);

        expect(result).toEqual({
            bookcaseId: bookcase.id,
            shelves: [
                { shelfId: upper.id, books: [] },
                { shelfId: lower.id, books: [dune] },
            ],
        });
    });
    it('reads only the shelves of the asked bookcase', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase, shelf } = await LocationDoubles.withShelf(current, 'Oak', 'Shelf 1');

        await LocationDoubles.withShelf(current, 'Hall', 'Shelf 1');

        await useCase(current).execute(owner, bookcase.id);

        expect(current.spines.asked).toEqual([[shelf.id]]);
    });
    it('refuses an unknown bookcase', async () => {
        const current = LocationDoubles.furniture();

        const result = useCase(current).execute(owner, 'missing');

        await expect(result).rejects.toMatchObject({ reason: 'bookcase-missing' });
    });
    it('refuses an account that must replace its temporary password', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', null);

        const result = useCase(current).execute(
            { ...owner, mustChangePassword: true },
            bookcase.id,
        );

        await expect(result).rejects.toMatchObject({ reason: 'temporary-password' });
    });
});
