import { describe, expect, it } from 'vitest';
import { CollectionDoubles, guest, owner } from '../testing/collection-doubles.test-support.js';
import { FinishCollection } from './finish-collection.usecase.js';

function subject(current: ReturnType<typeof CollectionDoubles.shelf>) {
    return new FinishCollection(
        current.collections,
        current.members,
        current.loader,
        current.viewer,
        current.clock,
        current.operations,
    );
}

describe('FinishCollection', () => {
    it('marks a collection Finished when every expected volume is Owned', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'omnibus', 'owned', 'Batman', 1, 3);

        const result = await subject(current).execute(owner, 'collection-1');

        expect(result.finished).toBe(true);
        expect(current.trail.entries[0]).toMatchObject({
            category: 'collection.finished',
            outcome: 'successful',
            after: { finished: true },
        });
    });

    it('refuses while a volume is missing', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);
        await CollectionDoubles.member(current, 'three', 'owned', 'Batman', 3);

        const operation = subject(current).execute(owner, 'collection-1');

        await expect(operation).rejects.toMatchObject({ reason: 'collection-incomplete' });
        expect(current.trail.entries[0]).toMatchObject({ outcome: 'failed' });
    });

    it('refuses a Guest', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);

        const operation = subject(current).execute(guest, 'collection-1');

        await expect(operation).rejects.toMatchObject({ code: 'forbidden' });
    });
});
