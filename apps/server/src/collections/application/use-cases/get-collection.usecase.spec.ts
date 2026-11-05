import { describe, expect, it } from 'vitest';
import { member, shelf } from '../testing/collection-doubles.test-support.js';
import { GetCollection } from './get-collection.usecase.js';

function subject(current: ReturnType<typeof shelf>) {
    return new GetCollection(current.loader, current.members, current.viewer);
}

describe('GetCollection', () => {
    it('groups editions under their volumes with inferred gaps', async () => {
        const current = shelf();

        await member(current, 'year-one', 'owned', 'Batman', 1);
        await member(current, 'omnibus', 'owned', 'Batman', 1, 3);
        await member(current, 'twelve', 'not-owned', 'Batman', 12);

        const result = await subject(current).execute('collection-1');

        expect(result).toMatchObject({
            name: 'Batman',
            bookCount: 3,
            expectedFrom: 1,
            expectedTo: 12,
            ownedCount: 3,
            missingCount: 9,
            lastOwned: 3,
        });
        expect(
            result.volumes.map((volume) => [
                volume.from,
                volume.to,
                volume.state,
                volume.books.map((book) => book.id),
            ]),
        ).toEqual([
            [1, 1, 'owned', ['year-one', 'omnibus']],
            [2, 2, 'owned', ['omnibus']],
            [3, 3, 'owned', ['omnibus']],
            [4, 11, 'inferred', []],
            [12, 12, 'planned', ['twelve']],
        ]);
    });

    it('counts five editions as four Owned volumes of five', async () => {
        const current = shelf();

        await member(current, 'one', 'owned', 'Batman', 1);
        await member(current, 'two', 'owned', 'Batman', 2);
        await member(current, 'paperback', 'owned', 'Batman', 3);
        await member(current, 'hardcover', 'owned', 'Batman', 3);
        await member(current, 'five', 'owned', 'Batman', 5);

        const result = await subject(current).execute('collection-1');

        expect(result).toMatchObject({
            bookCount: 5,
            ownedCount: 4,
            expectedCount: 5,
            missingCount: 1,
        });
    });

    it('refuses an unknown collection', async () => {
        const current = shelf();

        const operation = subject(current).execute('unknown');

        await expect(operation).rejects.toMatchObject({
            code: 'not_found',
            reason: 'collection-missing',
        });
    });
});
