import { describe, expect, it } from 'vitest';
import { guest, owner, TagDoubles } from '../testing/tag-doubles.test-support.js';
import { CreateTag } from './create-tag.usecase.js';

function subject(current: ReturnType<typeof TagDoubles.labels>) {
    return new CreateTag(
        current.tags,
        current.naming,
        current.viewer,
        current.ids,
        current.clock,
        current.operations,
    );
}

describe('CreateTag', () => {
    it('creates an unused tag', async () => {
        const current = TagDoubles.labels();

        const result = await subject(current).execute(owner, ' To explore ');

        expect(result).toEqual({ id: 'tag-1', name: 'To explore', bookCount: 0 });
    });
    it('records the creation', async () => {
        const current = TagDoubles.labels();

        await subject(current).execute(owner, 'Fantasy');

        expect(current.trail.entries).toEqual([
            expect.objectContaining({
                category: 'tag.created',
                subjectId: 'tag-1',
                after: { name: 'Fantasy' },
            }),
        ]);
    });
    it('refuses an equivalent existing name', async () => {
        const current = TagDoubles.labels();

        await TagDoubles.tagged(current, 'Fantasy');

        const result = subject(current).execute(owner, 'FANTASY');

        await expect(result).rejects.toMatchObject({ reason: 'tag-name-taken' });
    });
    it('refuses a Guest', async () => {
        const current = TagDoubles.labels();

        const result = subject(current).execute(guest, 'Fantasy');

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.tags.tags.size).toBe(0);
    });
});
