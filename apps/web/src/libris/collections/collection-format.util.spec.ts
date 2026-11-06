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

    it('describes an edition by its publisher and ISBN', () => {
        const parts = CollectionFormat.edition(
            member({ publisher: 'DC Comics', isbn: '9781401207526' }),
        );

        expect(parts).toEqual([
            'DC Comics',
            { key: 'collection.book.isbn', values: { isbn: '9781401207526' } },
        ]);
    });

    it('describes an edition without a publisher by its ISBN only', () => {
        const parts = CollectionFormat.edition(member({ isbn: '9781401207526' }));

        expect(parts).toEqual([{ key: 'collection.book.isbn', values: { isbn: '9781401207526' } }]);
    });

    it('describes an edition without an ISBN by its publisher only', () => {
        expect(CollectionFormat.edition(member({ publisher: 'DC Comics' }))).toEqual(['DC Comics']);
    });

    it('says an edition with neither publisher nor ISBN has no ISBN', () => {
        expect(CollectionFormat.edition(member())).toEqual([{ key: 'collection.book.noIsbn' }]);
    });

    it('starts with Not Owned and the omnibus coverage when they apply', () => {
        const parts = CollectionFormat.edition(
            member({ ownership: 'not-owned', volumeTo: 3, publisher: 'DC Comics' }),
        );

        expect(parts).toEqual([
            { key: 'status.notOwned' },
            { key: 'collection.book.omnibus', values: { from: 1, to: 3 } },
            'DC Comics',
        ]);
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
