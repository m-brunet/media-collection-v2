import { describe, expect, it } from 'vitest';
import { CollectionDoubles, guest, owner } from '../testing/collection-doubles.test-support.js';
import { ResumeCollection } from './resume-collection.usecase.js';

function subject(current: ReturnType<typeof CollectionDoubles.shelf>) {
    return new ResumeCollection(
        current.collections,
        current.members,
        current.loader,
        current.viewer,
        current.clock,
        current.operations,
    );
}

describe('ResumeCollection', () => {
    it('puts a dropped collection back to Unfinished', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'four', 'owned', 'Batman', 4);
        await CollectionDoubles.markDropped(current, 'collection-1');

        const result = await subject(current).execute(owner, 'collection-1');

        expect(result).toMatchObject({ status: 'unfinished', missingCount: 3 });
        expect(current.trail.entries[0]).toMatchObject({
            category: 'collection.resumed',
            outcome: 'successful',
            before: { status: 'dropped' },
            after: { status: 'unfinished' },
        });
    });

    it('refuses a collection that is not dropped', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);

        const operation = subject(current).execute(owner, 'collection-1');

        await expect(operation).rejects.toMatchObject({
            code: 'conflict',
            reason: 'collection-not-dropped',
        });
    });

    it('refuses a Guest', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);
        await CollectionDoubles.markDropped(current, 'collection-1');

        const operation = subject(current).execute(guest, 'collection-1');

        await expect(operation).rejects.toMatchObject({ code: 'forbidden' });
    });
});
