import { describe, expect, it } from 'vitest';
import { markFinished, member, shelf } from '../testing/collection-doubles.test-support.js';

describe('BookCollectionMembership', () => {
    it('creates a collection from a new name', async () => {
        const current = shelf();

        current.members.saveBook('year-one', 'owned');

        const result = await current.membership.assign(
            { id: 'year-one', ownership: 'owned' },
            { collection: { name: ' Batman ' }, volumeFrom: 1, volumeTo: 1 },
            [],
        );

        expect(result).toEqual({ id: 'collection-1', name: 'Batman', volumeFrom: 1, volumeTo: 1 });
        expect(current.collections.collections.get('collection-1')?.snapshot).toMatchObject({
            name: 'Batman',
            includesVolumeZero: false,
            finished: false,
        });
    });

    it('joins the collection of an equivalent name', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Astérix', 1);
        current.members.saveBook('two', 'owned');

        const result = await current.membership.assign(
            { id: 'two', ownership: 'owned' },
            { collection: { name: 'asterix' }, volumeFrom: 2, volumeTo: 2 },
            [],
        );

        expect(result).toMatchObject({ id: 'collection-1', name: 'Astérix' });
        expect(current.collections.collections.size).toBe(1);
    });

    it('asks before creating a collection with a similar name', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);
        current.members.saveBook('two', 'owned');

        const operation = current.membership.assign(
            { id: 'two', ownership: 'owned' },
            { collection: { name: 'Batmen' }, volumeFrom: 2, volumeTo: 2 },
            [],
        );

        await expect(operation).rejects.toMatchObject({
            reason: 'collection-similar',
            details: { name: 'Batmen', candidates: [{ id: 'collection-1', name: 'Batman' }] },
        });
    });

    it('creates a similar collection once confirmed distinct', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);
        current.members.saveBook('two', 'owned');

        const result = await current.membership.assign(
            { id: 'two', ownership: 'owned' },
            { collection: { name: 'Batmen', distinct: true }, volumeFrom: 1, volumeTo: 1 },
            [],
        );

        expect(result).toMatchObject({ name: 'Batmen' });
        expect(current.collections.collections.size).toBe(2);
    });

    it('refuses a collection that no longer exists', async () => {
        const current = shelf();

        current.members.saveBook('one', 'owned');

        const operation = current.membership.assign(
            { id: 'one', ownership: 'owned' },
            { collection: { id: 'gone' }, volumeFrom: 1, volumeTo: 1 },
            [],
        );

        await expect(operation).rejects.toMatchObject({ reason: 'collection-missing' });
    });

    it('asks to include volume 0 before saving its coverage', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);
        current.members.saveBook('zero', 'owned');

        const operation = current.membership.assign(
            { id: 'zero', ownership: 'owned' },
            { collection: { id: 'collection-1' }, volumeFrom: 0, volumeTo: 0 },
            [],
        );

        await expect(operation).rejects.toMatchObject({
            reason: 'volume-zero-disabled',
            details: { name: 'Batman' },
        });
        expect(current.members.memberships.has('zero')).toBe(false);
    });

    it('includes volume 0 in the collection when the person accepts', async () => {
        const current = shelf();

        current.members.saveBook('zero', 'owned');

        await current.membership.assign(
            { id: 'zero', ownership: 'owned' },
            {
                collection: { name: 'Batman' },
                volumeFrom: 0,
                volumeTo: 2,
                enableVolumeZero: true,
            },
            [],
        );

        expect(
            current.collections.collections.get('collection-1')?.snapshot.includesVolumeZero,
        ).toBe(true);
    });

    it('blocks a Not Owned volume inside an Owned omnibus', async () => {
        const current = shelf();

        await member(current, 'omnibus', 'owned', 'Batman', 1, 3);
        current.members.saveBook('two', 'not-owned', 'Batman 2');

        const operation = current.membership.assign(
            { id: 'two', ownership: 'not-owned' },
            { collection: { id: 'collection-1' }, volumeFrom: 2, volumeTo: 2 },
            [],
        );

        await expect(operation).rejects.toMatchObject({
            reason: 'coverage-conflict',
            details: {
                conflicts: [{ id: 'omnibus', ownership: 'owned', volumeFrom: 1, volumeTo: 3 }],
                replaceable: false,
                expectedAfterReplacement: null,
            },
        });
    });

    it('blocks a Not Owned omnibus over an Owned volume', async () => {
        const current = shelf();

        await member(current, 'two', 'owned', 'Batman', 2);
        current.members.saveBook('omnibus', 'not-owned');

        const operation = current.membership.assign(
            { id: 'omnibus', ownership: 'not-owned' },
            { collection: { id: 'collection-1' }, volumeFrom: 1, volumeTo: 3 },
            [],
        );

        await expect(operation).rejects.toMatchObject({ reason: 'coverage-conflict' });
    });

    it('blocks a book becoming Not Owned while an Owned edition covers its volume', async () => {
        const current = shelf();

        await member(current, 'paperback', 'owned', 'Batman', 3);
        await member(current, 'hardcover', 'owned', 'Batman', 3);

        const operation = current.membership.assign(
            { id: 'hardcover', ownership: 'not-owned' },
            { collection: { id: 'collection-1' }, volumeFrom: 3, volumeTo: 3 },
            [],
        );

        await expect(operation).rejects.toMatchObject({ reason: 'coverage-conflict' });
    });

    it('offers to replace the planned books a purchased omnibus overlaps', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);
        await member(current, 'planned', 'not-owned', 'Batman', 2, 5);
        current.members.saveBook('omnibus', 'owned');

        const operation = current.membership.assign(
            { id: 'omnibus', ownership: 'owned' },
            { collection: { id: 'collection-1' }, volumeFrom: 1, volumeTo: 3 },
            [],
        );

        await expect(operation).rejects.toMatchObject({
            reason: 'coverage-conflict',
            details: {
                name: 'Batman',
                conflicts: [{ id: 'planned', volumeFrom: 2, volumeTo: 5 }],
                replaceable: true,
                expectedAfterReplacement: { from: 1, to: 3 },
            },
        });
    });

    it('accepts an Owned omnibus replacing exactly the planned books it overlaps', async () => {
        const current = shelf();

        await member(current, 'one', 'not-owned', 'Batman', 1);
        await member(current, 'two', 'not-owned', 'Batman', 2);
        await member(current, 'three', 'not-owned', 'Batman', 3);
        current.members.saveBook('omnibus', 'owned');

        const result = await current.membership.assign(
            { id: 'omnibus', ownership: 'owned' },
            { collection: { id: 'collection-1' }, volumeFrom: 1, volumeTo: 3 },
            ['three', 'one', 'two'],
        );

        expect(result).toMatchObject({ volumeFrom: 1, volumeTo: 3 });
        expect(current.members.memberships.get('omnibus')).toMatchObject({
            collectionId: 'collection-1',
        });
    });

    it('refuses a replacement leaving out one of the conflicting planned books', async () => {
        const current = shelf();

        await member(current, 'one', 'not-owned', 'Batman', 1);
        await member(current, 'two', 'not-owned', 'Batman', 2);
        current.members.saveBook('omnibus', 'owned');

        const operation = current.membership.assign(
            { id: 'omnibus', ownership: 'owned' },
            { collection: { id: 'collection-1' }, volumeFrom: 1, volumeTo: 2 },
            ['one'],
        );

        await expect(operation).rejects.toMatchObject({ reason: 'coverage-conflict' });
    });

    it('refuses to replace books that no longer conflict', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);
        current.members.saveBook('two', 'owned');

        const operation = current.membership.assign(
            { id: 'two', ownership: 'owned' },
            { collection: { id: 'collection-1' }, volumeFrom: 2, volumeTo: 2 },
            ['one'],
        );

        await expect(operation).rejects.toMatchObject({ reason: 'replacement-outdated' });
    });

    it('reopens a Finished collection when a missing volume is saved', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);
        await markFinished(current, 'collection-1');
        current.members.saveBook('three', 'not-owned');

        await current.membership.assign(
            { id: 'three', ownership: 'not-owned' },
            { collection: { id: 'collection-1' }, volumeFrom: 3, volumeTo: 3 },
            [],
        );

        expect(current.collections.collections.get('collection-1')?.snapshot.finished).toBe(false);
    });

    it('removes the collection its final book is moved out of', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);

        await current.membership.assign(
            { id: 'one', ownership: 'owned' },
            { collection: { name: 'Superman' }, volumeFrom: 1, volumeTo: 1 },
            [],
        );

        expect(
            [...current.collections.collections.values()].map((value) => value.snapshot.name),
        ).toEqual(['Superman']);
    });

    it('removes the collection its final book is unlinked from, keeping the book', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);

        const result = await current.membership.assign({ id: 'one', ownership: 'owned' }, null, []);

        expect(result).toBeNull();
        expect(current.collections.collections.size).toBe(0);
        expect(current.members.books.has('one')).toBe(true);
    });

    it('keeps a collection that still has books after a book leaves', async () => {
        const current = shelf();

        await member(current, 'nineteen', 'owned', 'Batman', 19);
        await member(current, 'twenty', 'owned', 'Batman', 20);

        await current.membership.leave('twenty');

        expect(current.collections.collections.size).toBe(1);
        expect(current.members.memberships.has('twenty')).toBe(false);
    });

    it('removes the collection when its final book leaves', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);

        await current.membership.leave('one');

        expect(current.collections.collections.size).toBe(0);
    });

    it('describes the membership of a book', async () => {
        const current = shelf();

        await member(current, 'omnibus', 'owned', 'Batman', 1, 3);

        const result = await current.membership.of('omnibus');

        expect(result).toEqual({ id: 'collection-1', name: 'Batman', volumeFrom: 1, volumeTo: 3 });
    });

    it('describes a book outside any collection', async () => {
        const current = shelf();

        current.members.saveBook('standalone', 'owned');

        const result = await current.membership.of('standalone');

        expect(result).toBeNull();
    });
});
