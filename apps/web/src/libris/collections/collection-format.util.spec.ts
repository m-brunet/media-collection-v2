import { describe, expect, it } from 'vitest';
import type { CollectionSummaryDto } from '../../../../../packages/contracts/src/http';
import { CollectionFormat } from './collection-format.util';

function summary(overrides: Partial<CollectionSummaryDto> = {}): CollectionSummaryDto {
    return {
        id: 'c1',
        name: 'Batman',
        category: 'comics',
        includesVolumeZero: false,
        finished: false,
        bookCount: 1,
        expectedFrom: 1,
        expectedTo: 12,
        expectedCount: 12,
        ownedCount: 4,
        missingCount: 8,
        lastOwned: 4,
        previews: [],
        ...overrides,
    };
}

describe('CollectionFormat', () => {
    it('names a single volume', () => {
        const result = CollectionFormat.volumes(3, 3);

        expect(result).toEqual({ key: 'volume.one', values: { number: 3 } });
    });
    it('names a range of volumes', () => {
        const result = CollectionFormat.volumes(5, 11);

        expect(result).toEqual({ key: 'volume.range', values: { from: 5, to: 11 } });
    });
    it('states the expected coverage of a range in sentence case', () => {
        expect(CollectionFormat.expected(summary())).toEqual({
            key: 'collection.expectedRange',
            values: { from: 1, to: 12 },
        });
    });

    it('states the expected coverage of a single volume', () => {
        expect(CollectionFormat.expected(summary({ expectedFrom: 1, expectedTo: 1 }))).toEqual({
            key: 'collection.expectedOne',
            values: { number: 1 },
        });
    });

    it('counts the missing volumes of an unfinished collection', () => {
        const result = CollectionFormat.status(summary());

        expect(result).toEqual({ key: 'collection.statusMissing', values: { count: 8 } });
    });
    it('says an unfinished collection without gaps has no known missing volumes', () => {
        const result = CollectionFormat.status(summary({ missingCount: 0 }));

        expect(result).toEqual({ key: 'collection.statusNoGaps' });
    });
    it('shows a Finished collection as complete on its own page', () => {
        const result = CollectionFormat.coverage(summary({ finished: true, missingCount: 0 }));

        expect(result).toEqual({ key: 'collection.coverageComplete' });
    });
    it('counts the missing volumes on the page of an unfinished collection', () => {
        const result = CollectionFormat.coverage(summary());

        expect(result).toEqual({ key: 'collection.coverageMissing', values: { count: 8 } });
    });
    it('says on its page that an unfinished collection has no known missing volumes', () => {
        const result = CollectionFormat.coverage(summary({ missingCount: 0 }));

        expect(result).toEqual({ key: 'collection.coverageNoGaps' });
    });
    it('labels a Finished collection Finished', () => {
        const result = CollectionFormat.label(true);

        expect(result).toEqual({ key: 'collection.labelFinished' });
    });
    it('labels an unfinished collection Unfinished', () => {
        const result = CollectionFormat.label(false);

        expect(result).toEqual({ key: 'collection.labelUnfinished' });
    });
});
