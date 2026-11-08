import { describe, expect, it } from 'vitest';
import { CollectionDoubles, guest, owner } from '../testing/collection-doubles.test-support.js';
import { DeleteCollection } from './delete-collection.usecase.js';

function subject(current: ReturnType<typeof CollectionDoubles.shelf>) {
    return new DeleteCollection(
        current.collections,
        current.members,
        current.loader,
        current.titles,
        current.operations,
    );
}

describe('DeleteCollection', () => {
    it('deletes the collection and keeps its books without membership', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);
        await CollectionDoubles.member(current, 'two', 'not-owned', 'Batman', 2);

        await subject(current).execute(owner, 'collection-1');

        expect(current.collections.collections.size).toBe(0);
        expect(current.members.memberships.size).toBe(0);
        expect(current.members.books.size).toBe(2);
        expect(current.trail.entries[0]).toMatchObject({
            category: 'collection.deleted',
            before: { name: 'Batman', bookIds: ['one', 'two'] },
            after: null,
        });
    });

    it('refuses an unknown collection', async () => {
        const current = CollectionDoubles.shelf();

        const operation = subject(current).execute(owner, 'unknown');

        await expect(operation).rejects.toMatchObject({ reason: 'collection-missing' });
    });

    it('refuses a Guest', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);

        const operation = subject(current).execute(guest, 'collection-1');

        await expect(operation).rejects.toMatchObject({ code: 'forbidden' });
        expect(current.collections.collections.size).toBe(1);
    });
});

describe('DeleteCollection titles', () => {
    it('keeps the titles of its books (example 5)', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Gunnm', 1);
        await CollectionDoubles.member(current, 'two', 'owned', 'Gunnm', 2);

        await subject(current).execute(owner, 'collection-1');

        expect(current.titles.kept).toEqual([['one', 'two']]);
    });
});
