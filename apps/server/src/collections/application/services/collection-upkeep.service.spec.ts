import { describe, expect, it } from 'vitest';
import { markFinished, member, shelf } from '../testing/collection-doubles.test-support.js';

const now = '2026-03-01T10:00:00.000Z';

describe('CollectionUpkeep', () => {
    it('removes a collection without books', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);
        await current.members.remove('one');

        const outcome = await current.upkeep.tidy('collection-1', now);

        expect(outcome).toBe('removed');
        expect(current.collections.collections.size).toBe(0);
    });

    it('reopens a Finished collection left with a missing volume', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);
        await member(current, 'two', 'owned', 'Batman', 2);
        await markFinished(current, 'collection-1');
        await current.members.remove('one');

        const outcome = await current.upkeep.tidy('collection-1', now);

        expect(outcome).toBe('reopened');
        expect(current.collections.collections.get('collection-1')?.snapshot.finished).toBe(false);
    });

    it('keeps a Finished collection whose highest volume was removed', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);
        await member(current, 'two', 'owned', 'Batman', 2);
        await markFinished(current, 'collection-1');
        await current.members.remove('two');

        const outcome = await current.upkeep.tidy('collection-1', now);

        expect(outcome).toBe('unchanged');
        expect(current.collections.collections.get('collection-1')?.snapshot.finished).toBe(true);
    });
});
