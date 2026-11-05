import { describe, expect, it } from 'vitest';
import { labels, tagged } from '../testing/tag-doubles.test-support.js';

describe('TagLoader', () => {
    it('loads a saved tag', async () => {
        const current = labels();
        const tag = await tagged(current, 'Fantasy');

        const result = await current.loader.load(tag.id);

        expect(result.snapshot.name).toBe('Fantasy');
    });
    it('reports an unknown tag', async () => {
        const current = labels();

        const result = current.loader.load('unknown');

        await expect(result).rejects.toMatchObject({ code: 'not_found', reason: 'tag-missing' });
    });
});
