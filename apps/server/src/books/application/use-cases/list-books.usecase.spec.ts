import { describe, expect, it } from 'vitest';
import { guest, library, owner, saved } from '../testing/book-doubles.test-support.js';
import { ListBooks } from './list-books.usecase.js';

const query = {
    search: '',
    sort: 'title' as const,
    direction: 'asc' as const,
    offset: 0,
    limit: 48,
};

describe('ListBooks', () => {
    it('lists books with the viewer reading status', async () => {
        const current = library();

        await saved(current);

        const result = await new ListBooks(current.catalog).execute(owner, query);

        expect(result.total).toBe(1);
        expect(result.items[0]!.read).toBe(false);
    });
    it('lists books for a Guest without reading status', async () => {
        const current = library();

        await saved(current);

        const result = await new ListBooks(current.catalog).execute(guest, query);

        expect(result.items[0]!.read).toBeNull();
    });
    it('requires a replaced temporary password', async () => {
        const current = library();

        const result = new ListBooks(current.catalog).execute(
            { ...owner, mustChangePassword: true },
            query,
        );

        await expect(result).rejects.toMatchObject({ reason: 'temporary-password' });
    });
});
