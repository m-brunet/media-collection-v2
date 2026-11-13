import { describe, expect, it } from 'vitest';
import { CollectionDoubles, guest, owner } from '../testing/collection-doubles.test-support.js';
import { UpdateCollection } from './update-collection.usecase.js';

function subject(current: ReturnType<typeof CollectionDoubles.shelf>) {
    return new UpdateCollection(
        current.collections,
        current.members,
        current.loader,
        current.viewer,
        current.titles,
        current.categories,
        current.clock,
        current.operations,
    );
}

describe('UpdateCollection', () => {
    it('renames the collection for every member book', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);

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

    it('changes the category of the collection and of every member book', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);
        await CollectionDoubles.member(current, 'two', 'owned', 'Batman', 2);

        const result = await subject(current).execute(owner, 'collection-1', {
            category: 'manga',
        });

        expect(result.category).toBe('manga');
        expect(current.collections.collections.get('collection-1')?.snapshot.category).toBe(
            'manga',
        );
        expect(current.categories.changed).toEqual([
            { category: 'manga', bookIds: ['one', 'two'] },
        ]);
    });

    it('records the collection and every changed book in one operation', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);
        await CollectionDoubles.member(current, 'two', 'owned', 'Batman', 2);
        const recorded = current.trail.entries.length;

        await subject(current).execute(owner, 'collection-1', { category: 'manga' });

        const entries = current.trail.entries.slice(recorded);

        expect(entries.map((entry) => [entry.category, entry.subjectId])).toEqual([
            ['collection.updated', 'collection-1'],
            ['book.category-changed', 'one'],
            ['book.category-changed', 'two'],
        ]);
        expect(new Set(entries.map((entry) => entry.operationId)).size).toBe(1);
        expect(entries[0]).toMatchObject({
            before: { category: 'comics' },
            after: { category: 'manga' },
        });
    });

    it('leaves the books alone when the category stays the same', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);

        await subject(current).execute(owner, 'collection-1', { category: 'comics' });

        expect(current.categories.changed).toEqual([]);
    });

    it('refuses a category change by a Guest', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);

        const operation = subject(current).execute(guest, 'collection-1', { category: 'manga' });

        await expect(operation).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.categories.changed).toEqual([]);
    });

    it('accepts a new spelling of the same name', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);

        const result = await subject(current).execute(owner, 'collection-1', { name: 'BATMAN' });

        expect(result.name).toBe('BATMAN');
    });

    it('refuses the name of another collection', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);
        await CollectionDoubles.member(current, 'two', 'owned', 'Superman', 1);

        const operation = subject(current).execute(owner, 'collection-2', { name: 'batman' });

        await expect(operation).rejects.toMatchObject({ reason: 'collection-name-taken' });
    });

    it('includes volume 0 and reopens a Finished collection missing it', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);
        await CollectionDoubles.markFinished(current, 'collection-1');

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
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'zero', 'owned', 'Batman', 0);

        const operation = subject(current).execute(owner, 'collection-1', {
            includesVolumeZero: false,
        });

        await expect(operation).rejects.toMatchObject({ reason: 'volume-zero-in-use' });
    });

    it('refuses a Guest', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);

        const operation = subject(current).execute(guest, 'collection-1', { name: 'Other' });

        await expect(operation).rejects.toMatchObject({ code: 'forbidden' });
    });
});

describe('UpdateCollection titles', () => {
    it('regenerates the generated titles of its books with the new name (example 3)', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Gunnm', 1);
        await CollectionDoubles.member(current, 'two', 'owned', 'Gunnm', 2, 3);

        await subject(current).execute(owner, 'collection-1', { name: 'Battle Angel Alita' });

        expect(current.titles.regenerated).toEqual([
            {
                collectionName: 'Battle Angel Alita',
                members: [
                    { bookId: 'one', volumeFrom: 1, volumeTo: 1 },
                    { bookId: 'two', volumeFrom: 2, volumeTo: 3 },
                ],
            },
        ]);
    });
    it('records the title changes with the rename', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Gunnm', 1);

        await subject(current).execute(owner, 'collection-1', { name: 'Battle Angel Alita' });

        expect(current.trail.entries.map((entry) => [entry.category, entry.operationId])).toEqual([
            ['collection.updated', 'operation-1'],
            ['book.retitled', 'operation-1'],
        ]);
    });
    it('leaves titles alone when the name does not change', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Gunnm', 0);

        await subject(current).execute(owner, 'collection-1', { includesVolumeZero: true });

        expect(current.titles.regenerated).toEqual([]);
    });
});
