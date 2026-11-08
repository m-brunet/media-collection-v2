import { describe, expect, it } from 'vitest';
import { CollectionDoubles, guest, owner } from '../testing/collection-doubles.test-support.js';
import { ReopenCollection } from './reopen-collection.usecase.js';

function subject(current: ReturnType<typeof CollectionDoubles.shelf>) {
    return new ReopenCollection(
        current.collections,
        current.members,
        current.loader,
        current.viewer,
        current.clock,
        current.operations,
    );
}

describe('ReopenCollection', () => {
    it('reopens a Finished collection without any gap', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);
        await CollectionDoubles.markFinished(current, 'collection-1');

        const result = await subject(current).execute(owner, 'collection-1');

        expect(result).toMatchObject({ finished: false, missingCount: 0 });
        expect(current.trail.entries[0]).toMatchObject({
            category: 'collection.reopened',
            before: { finished: true },
            after: { finished: false },
        });
    });

    it('refuses a Guest', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);
        await CollectionDoubles.markFinished(current, 'collection-1');

        const operation = subject(current).execute(guest, 'collection-1');

        await expect(operation).rejects.toMatchObject({ code: 'forbidden' });
    });
});
