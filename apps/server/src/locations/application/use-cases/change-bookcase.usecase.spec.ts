import { describe, expect, it } from 'vitest';
import {
    administrator,
    guest,
    LocationDoubles,
    owner,
} from '../testing/location-doubles.test-support.js';
import { ChangeBookcase } from './change-bookcase.usecase.js';

function subject(current: ReturnType<typeof LocationDoubles.furniture>) {
    return new ChangeBookcase(
        current.bookcases,
        current.loader,
        current.naming,
        current.overview,
        current.clock,
        current.operations,
    );
}

describe('ChangeBookcase, renaming', () => {
    it('renames a bookcase, keeping its shelves', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        const result = await subject(current).execute(owner, bookcase.id, {
            name: 'Oak bookcase',
        });

        expect(result.name).toBe('Oak bookcase');
        expect(result.size).toBe('large');
        expect(result.shelves.map((shelf) => shelf.name)).toEqual(['Top']);
    });
    it('records the previous and new names', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        await subject(current).execute(owner, bookcase.id, { name: 'Hall' });

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'bookcase.renamed',
            before: { name: 'Oak' },
            after: { name: 'Hall' },
        });
    });
    it('accepts another spelling of its own name', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        const result = await subject(current).execute(owner, bookcase.id, { name: 'OAK' });

        expect(result.name).toBe('OAK');
    });
    it('refuses the name of another bookcase', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        await LocationDoubles.withShelf(current, 'Hall', null);

        const result = subject(current).execute(owner, bookcase.id, { name: 'hall' });

        await expect(result).rejects.toMatchObject({ reason: 'bookcase-name-taken' });
    });
    it('reports an unknown bookcase', async () => {
        const current = LocationDoubles.furniture();

        const result = subject(current).execute(owner, 'unknown', { name: 'Hall' });

        await expect(result).rejects.toMatchObject({ reason: 'bookcase-missing' });
    });
    it('refuses a Guest', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        const result = subject(current).execute(guest, bookcase.id, { name: 'Hall' });

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
    });
});

describe('ChangeBookcase, resizing', () => {
    it('lets an Owner make a bookcase Small', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        const result = await subject(current).execute(owner, bookcase.id, { size: 'small' });

        expect(result).toMatchObject({ name: 'Oak', size: 'small' });
    });
    it('lets an Admin make a bookcase Small', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        const result = await subject(current).execute(administrator, bookcase.id, {
            size: 'small',
        });

        expect(result.size).toBe('small');
    });
    it('saves the size', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        await subject(current).execute(owner, bookcase.id, { size: 'small' });

        const saved = await current.bookcases.findById(bookcase.id);
        expect(saved?.snapshot.size).toBe('small');
    });
    it('records the previous and new sizes as a resize', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        await subject(current).execute(owner, bookcase.id, { size: 'small' });

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'bookcase.resized',
            before: { name: 'Oak', size: 'large' },
            after: { name: 'Oak', size: 'small' },
        });
    });
    it('records a resize when the name sent is unchanged', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        await subject(current).execute(owner, bookcase.id, { name: 'Oak', size: 'small' });

        expect(current.trail.entries.at(-1)).toMatchObject({ category: 'bookcase.resized' });
    });
    it('records a rename when the name and the size change together', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        await subject(current).execute(owner, bookcase.id, { name: 'Hall', size: 'small' });

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'bookcase.renamed',
            before: { name: 'Oak', size: 'large' },
            after: { name: 'Hall', size: 'small' },
        });
    });
    it('refuses a Guest', async () => {
        const current = LocationDoubles.furniture();
        const { bookcase } = await LocationDoubles.withShelf(current, 'Oak', 'Top');

        const result = subject(current).execute(guest, bookcase.id, { size: 'small' });

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
    });
});
