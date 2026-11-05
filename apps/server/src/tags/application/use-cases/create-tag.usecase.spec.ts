import { describe, expect, it } from 'vitest';
import { guest, labels, owner, tagged } from '../testing/tag-doubles.test-support.js';
import { CreateTag } from './create-tag.usecase.js';

function subject(current: ReturnType<typeof labels>) {
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
        const current = labels();

        const result = await subject(current).execute(owner, ' To explore ');

        expect(result).toEqual({ id: 'tag-1', name: 'To explore', bookCount: 0 });
    });
    it('records the creation', async () => {
        const current = labels();

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
        const current = labels();

        await tagged(current, 'Fantasy');

        const result = subject(current).execute(owner, 'FANTASY');

        await expect(result).rejects.toMatchObject({ reason: 'tag-name-taken' });
    });
    it('refuses a Guest', async () => {
        const current = labels();

        const result = subject(current).execute(guest, 'Fantasy');

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.tags.tags.size).toBe(0);
    });
});
