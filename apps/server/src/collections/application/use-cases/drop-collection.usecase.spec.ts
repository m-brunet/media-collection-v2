import { describe, expect, it } from 'vitest';
import { CollectionDoubles, guest, owner } from '../testing/collection-doubles.test-support.js';
import { DropCollection } from './drop-collection.usecase.js';

function subject(current: ReturnType<typeof CollectionDoubles.shelf>) {
    return new DropCollection(
        current.collections,
        current.members,
        current.loader,
        current.viewer,
        current.clock,
        current.operations,
    );
}

describe('DropCollection', () => {
    it('drops an unfinished collection whatever its missing volumes', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'four', 'owned', 'Batman', 4);

        const result = await subject(current).execute(owner, 'collection-1');

        expect(result).toMatchObject({ status: 'dropped', missingCount: 3 });
        expect(current.trail.entries[0]).toMatchObject({
            category: 'collection.dropped',
            outcome: 'successful',
            before: { status: 'unfinished' },
            after: { status: 'dropped' },
        });
    });

    it('drops an unfinished collection without any gap', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);

        const result = await subject(current).execute(owner, 'collection-1');

        expect(result).toMatchObject({ status: 'dropped', missingCount: 0 });
    });

    it('refuses a Finished collection', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);
        await CollectionDoubles.markFinished(current, 'collection-1');

        const operation = subject(current).execute(owner, 'collection-1');

        await expect(operation).rejects.toMatchObject({
            code: 'conflict',
            reason: 'collection-finished',
        });
    });

    it('refuses a Guest', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);

        const operation = subject(current).execute(guest, 'collection-1');

        await expect(operation).rejects.toMatchObject({ code: 'forbidden' });
    });
});
