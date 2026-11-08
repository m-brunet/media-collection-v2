import { describe, expect, it } from 'vitest';
import { guest, LocationDoubles, owner } from '../testing/location-doubles.test-support.js';
import { CreateShelf } from './create-shelf.usecase.js';

function subject(current: ReturnType<typeof LocationDoubles.furniture>) {
    return new CreateShelf(
        current.shelves,
        current.loader,
        current.naming,
        current.overview,
        current.ids,
        current.clock,
        current.operations,
    );
}

describe('CreateShelf', () => {
    it('creates an empty shelf inside a bookcase', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', null);

        const result = await subject(current).execute(owner, bookcase.id, 'Shelf 4');

        expect(result).toEqual({
            id: 'location-2',
            bookcaseId: bookcase.id,
            name: 'Shelf 4',
            bookCount: 0,
        });
    });
    it('records the creation with its bookcase', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', null);

        await subject(current).execute(owner, bookcase.id, 'Top');

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'shelf.created',
            subjectId: 'location-2',
            after: { name: 'Top', bookcaseId: bookcase.id, bookcaseName: 'Oak' },
        });
    });
    it('accepts a shelf name another bookcase already uses', async () => {
        const current = LocationDoubles.furniture();

        await LocationDoubles.withShelf(current, 'Oak', 'Top');
        const { bookcase } = await LocationDoubles.withShelf(current, 'Study', null);

        const result = await subject(current).execute(owner, bookcase.id, 'Top');

        expect(result.name).toBe('Top');
    });
    it('refuses an equivalent shelf name in the same bookcase', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        const result = subject(current).execute(owner, bookcase.id, ' top');

        await expect(result).rejects.toMatchObject({ reason: 'shelf-name-taken' });
    });
    it('reports an unknown bookcase', async () => {
        const current = LocationDoubles.furniture();

        const result = subject(current).execute(owner, 'unknown', 'Top');

        await expect(result).rejects.toMatchObject({ reason: 'bookcase-missing' });
    });
    it('refuses a Guest', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', null);

        const result = subject(current).execute(guest, bookcase.id, 'Top');

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
    });
});
