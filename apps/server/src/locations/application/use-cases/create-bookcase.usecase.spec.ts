import { describe, expect, it } from 'vitest';
import { furniture, guest, owner, withShelf } from '../testing/location-doubles.test-support.js';
import { CreateBookcase } from './create-bookcase.usecase.js';

function subject(current: ReturnType<typeof furniture>) {
    return new CreateBookcase(
        current.bookcases,
        current.naming,
        current.overview,
        current.ids,
        current.clock,
        current.operations,
    );
}

describe('CreateBookcase', () => {
    it('creates an empty bookcase that stays available', async () => {
        const current = furniture();

        const result = await subject(current).execute(owner, ' Oak bookcase ');

        expect(result).toEqual({
            id: 'location-1',
            name: 'Oak bookcase',
            bookCount: 0,
            shelves: [],
        });
        expect(current.bookcases.bookcases.size).toBe(1);
    });
    it('records the creation', async () => {
        const current = furniture();

        await subject(current).execute(owner, 'Oak');

        expect(current.trail.entries).toEqual([
            expect.objectContaining({
                category: 'bookcase.created',
                subjectType: 'bookcase',
                subjectId: 'location-1',
                after: { name: 'Oak' },
            }),
        ]);
    });
    it('refuses an equivalent bookcase name', async () => {
        const current = furniture();

        await withShelf(current, 'Étude', null);

        const result = subject(current).execute(owner, 'etude');

        await expect(result).rejects.toMatchObject({ reason: 'bookcase-name-taken' });
    });
    it('refuses a Guest', async () => {
        const current = furniture();

        const result = subject(current).execute(guest, 'Oak');

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.bookcases.bookcases.size).toBe(0);
    });
});
