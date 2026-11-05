import { describe, expect, it } from 'vitest';
import { labels, tagged } from '../testing/tag-doubles.test-support.js';

describe('TagNaming', () => {
    it('refuses an equivalent name', async () => {
        const current = labels();

        await tagged(current, 'Médiéval');

        const result = current.naming.ensureAvailable(' MEDIEVAL ', null);

        await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'tag-name-taken' });
    });
    it('accepts the current name of the tag being renamed', async () => {
        const current = labels();
        const tag = await tagged(current, 'Fantasy');

        const result = current.naming.ensureAvailable('fantasy', tag.id);

        await expect(result).resolves.toBeUndefined();
    });
    it('accepts a new name', async () => {
        const current = labels();

        await tagged(current, 'Fantasy');

        const result = current.naming.ensureAvailable('Adventure', null);

        await expect(result).resolves.toBeUndefined();
    });
});
