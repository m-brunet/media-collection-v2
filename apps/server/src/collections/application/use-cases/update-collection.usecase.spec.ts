import { describe, expect, it } from 'vitest';
import {
    guest,
    markFinished,
    member,
    owner,
    shelf,
} from '../testing/collection-doubles.test-support.js';
import { UpdateCollection } from './update-collection.usecase.js';

function subject(current: ReturnType<typeof shelf>) {
    return new UpdateCollection(
        current.collections,
        current.members,
        current.loader,
        current.viewer,
        current.clock,
        current.operations,
    );
}

describe('UpdateCollection', () => {
    it('renames the collection for every member book', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);

        const result = await subject(current).execute(owner, 'collection-1', {
            name: 'The Batman',
        });

        expect(result.name).toBe('The Batman');
        expect(current.collections.collections.get('collection-1')?.snapshot.name).toBe(
            'The Batman',
        );
        expect(current.trail.entries[0]).toMatchObject({
            category: 'collection.updated',
            outcome: 'successful',
            before: { name: 'Batman' },
            after: { name: 'The Batman' },
        });
    });

    it('accepts a new spelling of the same name', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);

        const result = await subject(current).execute(owner, 'collection-1', { name: 'BATMAN' });

        expect(result.name).toBe('BATMAN');
    });

    it('refuses the name of another collection', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);
        await member(current, 'two', 'owned', 'Superman', 1);

        const operation = subject(current).execute(owner, 'collection-2', { name: 'batman' });

        await expect(operation).rejects.toMatchObject({ reason: 'collection-name-taken' });
    });

    it('includes volume 0 and reopens a Finished collection missing it', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);
        await markFinished(current, 'collection-1');

        const result = await subject(current).execute(owner, 'collection-1', {
            includesVolumeZero: true,
        });

        expect(result).toMatchObject({
            includesVolumeZero: true,
            finished: false,
            missingCount: 1,
        });
    });

    it('refuses to stop including volume 0 while a book covers it', async () => {
        const current = shelf();

        await member(current, 'zero', 'owned', 'Batman', 0);

        const operation = subject(current).execute(owner, 'collection-1', {
            includesVolumeZero: false,
        });

        await expect(operation).rejects.toMatchObject({ reason: 'volume-zero-in-use' });
    });

    it('refuses a Guest', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);

        const operation = subject(current).execute(guest, 'collection-1', { name: 'Other' });

        await expect(operation).rejects.toMatchObject({ code: 'forbidden' });
    });
});
