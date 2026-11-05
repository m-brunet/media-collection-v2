import { describe, expect, it } from 'vitest';
import { furniture, guest, owner, withShelf } from '../testing/location-doubles.test-support.js';
import { RenameBookcase } from './rename-bookcase.usecase.js';

function subject(current: ReturnType<typeof furniture>) {
    return new RenameBookcase(
        current.bookcases,
        current.loader,
        current.naming,
        current.overview,
        current.clock,
        current.operations,
    );
}

describe('RenameBookcase', () => {
    it('renames a bookcase, keeping its shelves', async () => {
        const current = furniture();
        const { bookcase } = await withShelf(current, 'Oak', 'Top');

        const result = await subject(current).execute(owner, bookcase.id, 'Oak bookcase');

        expect(result.name).toBe('Oak bookcase');
        expect(result.shelves.map((shelf) => shelf.name)).toEqual(['Top']);
    });
    it('records the previous and new names', async () => {
        const current = furniture();
        const { bookcase } = await withShelf(current, 'Oak', 'Top');

        await subject(current).execute(owner, bookcase.id, 'Hall');

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'bookcase.renamed',
            before: { name: 'Oak' },
            after: { name: 'Hall' },
        });
    });
    it('accepts another spelling of its own name', async () => {
        const current = furniture();
        const { bookcase } = await withShelf(current, 'Oak', 'Top');

        const result = await subject(current).execute(owner, bookcase.id, 'OAK');

        expect(result.name).toBe('OAK');
    });
    it('refuses the name of another bookcase', async () => {
        const current = furniture();
        const { bookcase } = await withShelf(current, 'Oak', 'Top');

        await withShelf(current, 'Hall', null);

        const result = subject(current).execute(owner, bookcase.id, 'hall');

        await expect(result).rejects.toMatchObject({ reason: 'bookcase-name-taken' });
    });
    it('reports an unknown bookcase', async () => {
        const current = furniture();

        const result = subject(current).execute(owner, 'unknown', 'Hall');

        await expect(result).rejects.toMatchObject({ reason: 'bookcase-missing' });
    });
    it('refuses a Guest', async () => {
        const current = furniture();
        const { bookcase } = await withShelf(current, 'Oak', 'Top');

        const result = subject(current).execute(guest, bookcase.id, 'Hall');

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
    });
});
