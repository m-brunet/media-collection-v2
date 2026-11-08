import { describe, expect, it } from 'vitest';
import { guest, owner, TagDoubles } from '../testing/tag-doubles.test-support.js';
import { RenameTag } from './rename-tag.usecase.js';

function subject(current: ReturnType<typeof TagDoubles.labels>) {
    return new RenameTag(
        current.tags,
        current.store,
        current.loader,
        current.naming,
        current.viewer,
        current.clock,
        current.operations,
    );
}

describe('RenameTag', () => {
    it('renames the tag, keeping its books', async () => {
        const current = TagDoubles.labels();
        const tag = await TagDoubles.tagged(current, 'Fantasy');

        await TagDoubles.labelled(current, 'dune', tag);

        const result = await subject(current).execute(owner, tag.id, 'High fantasy');

        expect(result).toEqual({ id: tag.id, name: 'High fantasy', bookCount: 1 });
        expect(current.store.links.get('dune')).toEqual([tag.id]);
    });
    it('records the previous and new names', async () => {
        const current = TagDoubles.labels();
        const tag = await TagDoubles.tagged(current, 'Fantasy');

        await subject(current).execute(owner, tag.id, 'High fantasy');

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'tag.renamed',
            before: { name: 'Fantasy' },
            after: { name: 'High fantasy' },
        });
    });
    it('accepts another spelling of its own name', async () => {
        const current = TagDoubles.labels();
        const tag = await TagDoubles.tagged(current, 'Medieval');

        const result = await subject(current).execute(owner, tag.id, 'Médiéval');

        expect(result.name).toBe('Médiéval');
    });
    it('refuses the name of another tag', async () => {
        const current = TagDoubles.labels();
        const tag = await TagDoubles.tagged(current, 'Fantasy');

        await TagDoubles.tagged(current, 'Adventure');

        const result = subject(current).execute(owner, tag.id, 'adventure');

        await expect(result).rejects.toMatchObject({ reason: 'tag-name-taken' });
    });
    it('reports an unknown tag', async () => {
        const current = TagDoubles.labels();

        const result = subject(current).execute(owner, 'unknown', 'Fantasy');

        await expect(result).rejects.toMatchObject({ reason: 'tag-missing' });
    });
    it('refuses a Guest', async () => {
        const current = TagDoubles.labels();
        const tag = await TagDoubles.tagged(current, 'Fantasy');

        const result = subject(current).execute(guest, tag.id, 'Adventure');

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
    });
});
