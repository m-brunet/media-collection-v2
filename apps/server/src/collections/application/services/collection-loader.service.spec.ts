import { describe, expect, it } from 'vitest';
import { CollectionDoubles } from '../testing/collection-doubles.test-support.js';

describe('CollectionLoader', () => {
    it('loads a saved collection', async () => {
        const current = CollectionDoubles.shelf();

        await CollectionDoubles.member(current, 'one', 'owned', 'Batman', 1);

        const collection = await current.loader.load('collection-1');

        expect(collection.snapshot.name).toBe('Batman');
    });

    it('refuses an unknown collection', async () => {
        const current = CollectionDoubles.shelf();

        const operation = current.loader.load('unknown');

        await expect(operation).rejects.toMatchObject({
            code: 'not_found',
            reason: 'collection-missing',
        });
    });
});
