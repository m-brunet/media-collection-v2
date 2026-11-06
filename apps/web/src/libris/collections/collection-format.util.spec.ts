import { describe, expect, it } from 'vitest';
import type {
    CollectionMemberDto,
    CollectionSummaryDto,
} from '../../../../../packages/contracts/src/http';
import { CollectionFormat } from './collection-format.util';

function summary(overrides: Partial<CollectionSummaryDto> = {}): CollectionSummaryDto {
    return {
        id: 'c1',
        name: 'Batman',
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

function member(overrides: Partial<CollectionMemberDto> = {}): CollectionMemberDto {
    return {
        id: 'b1',
        title: 'Year One',
        isbn: null,
        publisher: null,
        category: 'comics',
        ownership: 'owned',
        hasCover: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
        volumeFrom: 1,
        volumeTo: 1,
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
    it('counts the missing volumes of an unfinished collection', () => {
        const result = CollectionFormat.status(summary());

        expect(result).toEqual({ key: 'collection.statusMissing', values: { count: 8 } });
    });
    it('says an unfinished collection without gaps has no known missing volumes', () => {
        const result = CollectionFormat.status(summary({ missingCount: 0 }));

        expect(result).toEqual({ key: 'collection.statusNoGaps' });
    });
    it('shows a Finished collection as complete on its own page', () => {
        const result = CollectionFormat.badge(summary({ finished: true, missingCount: 0 }));

        expect(result).toEqual({ key: 'collection.statusFinished' });
    });
    it('describes a volume covered only by an omnibus', () => {
        const volume = {
            from: 3,
            to: 3,
            state: 'owned' as const,
            books: [member({ volumeFrom: 1, volumeTo: 3 })],
        };

        const result = CollectionFormat.state(volume);

        expect(result).toEqual({ key: 'collection.state.ownedBy', values: { from: 1, to: 3 } });
    });
    it('counts the editions of an Owned volume', () => {
        const volume = {
            from: 1,
            to: 1,
            state: 'owned' as const,
            books: [member(), member({ id: 'b2', volumeFrom: 1, volumeTo: 3 })],
        };

        const result = CollectionFormat.state(volume);

        expect(result).toEqual({ key: 'collection.state.ownedMany', values: { count: 2 } });
    });
    it('describes planned and inferred volumes as missing', () => {
        const planned = { from: 12, to: 12, state: 'planned' as const, books: [member()] };

        const results = [
            CollectionFormat.state(planned),
            CollectionFormat.state({ from: 5, to: 11, state: 'inferred', books: [] }),
        ];

        expect(results).toEqual([
            { key: 'collection.state.planned' },
            { key: 'collection.state.inferred' },
        ]);
    });
});
