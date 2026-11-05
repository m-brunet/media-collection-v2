import { describe, expect, it } from 'vitest';
import { guest, labelled, labels, owner, tagged } from '../testing/tag-doubles.test-support.js';
import { DeleteTag } from './delete-tag.usecase.js';

function subject(current: ReturnType<typeof labels>) {
    return new DeleteTag(current.tags, current.store, current.loader, current.operations);
}

describe('DeleteTag', () => {
    it('removes the tag from its books, keeping the books', async () => {
        const current = labels();
        const fantasy = await tagged(current, 'Fantasy');
        const adventure = await tagged(current, 'Adventure');

        await labelled(current, 'dune', fantasy, adventure);

        await subject(current).execute(owner, fantasy.id);

        expect(current.tags.tags.has(fantasy.id)).toBe(false);
        expect(current.store.links.get('dune')).toEqual([adventure.id]);
    });
    it('records the number of books it was removed from', async () => {
        const current = labels();
        const fantasy = await tagged(current, 'Fantasy');

        await labelled(current, 'dune', fantasy);
        await labelled(current, 'piranesi', fantasy);

        await subject(current).execute(owner, fantasy.id);

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'tag.deleted',
            before: { name: 'Fantasy', untaggedBooks: 2 },
            after: null,
        });
    });
    it('reports an unknown tag', async () => {
        const current = labels();

        const result = subject(current).execute(owner, 'unknown');

        await expect(result).rejects.toMatchObject({ reason: 'tag-missing' });
    });
    it('refuses a Guest and keeps the tag', async () => {
        const current = labels();
        const tag = await tagged(current, 'Fantasy');

        const result = subject(current).execute(guest, tag.id);

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.tags.tags.size).toBe(1);
    });
});
