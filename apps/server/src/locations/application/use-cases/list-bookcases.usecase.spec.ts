import { describe, expect, it } from 'vitest';
import {
    furniture,
    guest,
    owner,
    placed,
    withShelf,
} from '../testing/location-doubles.test-support.js';
import { ListBookcases } from './list-bookcases.usecase.js';

describe('ListBookcases', () => {
    it('lists bookcases with their shelves and book counts', async () => {
        const current = furniture();
        const { shelf } = await withShelf(current, 'Oak bookcase', 'Shelf 3');

        await placed(current, 'dune', shelf.id);

        const result = await new ListBookcases(current.overview).execute(guest);

        expect(result).toEqual([
            {
                id: shelf.snapshot.bookcaseId,
                name: 'Oak bookcase',
                bookCount: 1,
                shelves: [
                    {
                        id: shelf.id,
                        bookcaseId: shelf.snapshot.bookcaseId,
                        name: 'Shelf 3',
                        bookCount: 1,
                    },
                ],
            },
        ]);
    });
    it('refuses an account that must replace its temporary password', async () => {
        const current = furniture();

        const result = new ListBookcases(current.overview).execute({
            ...owner,
            mustChangePassword: true,
        });

        await expect(result).rejects.toMatchObject({ reason: 'temporary-password' });
    });
});
