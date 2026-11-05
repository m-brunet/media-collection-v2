import { describe, expect, it } from 'vitest';
import { furniture, withShelf } from '../testing/location-doubles.test-support.js';

describe('LocationNaming', () => {
    it('refuses an equivalent bookcase name', async () => {
        const current = furniture();

        await withShelf(current, 'Oak bookcase', 'Top');

        const result = current.naming.ensureBookcaseAvailable(' OAK Bookcase', null);

        await expect(result).rejects.toMatchObject({
            code: 'conflict',
            reason: 'bookcase-name-taken',
        });
    });
    it('accepts the current name of the bookcase being renamed', async () => {
        const current = furniture();
        const { bookcase } = await withShelf(current, 'Oak', 'Top');

        const result = current.naming.ensureBookcaseAvailable('oak', bookcase.id);

        await expect(result).resolves.toBeUndefined();
    });
    it('refuses an equivalent shelf name in the same bookcase', async () => {
        const current = furniture();
        const { bookcase } = await withShelf(current, 'Oak', 'Top');

        const result = current.naming.ensureShelfAvailable(bookcase.id, 'top', null);

        await expect(result).rejects.toMatchObject({
            code: 'conflict',
            reason: 'shelf-name-taken',
        });
    });
    it('accepts the same shelf name in another bookcase', async () => {
        const current = furniture();

        await withShelf(current, 'Oak', 'Top');
        const { bookcase } = await withShelf(current, 'Study', 'Bottom');

        const result = current.naming.ensureShelfAvailable(bookcase.id, 'Top', null);

        await expect(result).resolves.toBeUndefined();
    });
});
