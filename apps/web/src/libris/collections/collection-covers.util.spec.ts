import { expect, it } from 'vitest';
import type {
    CollectionDetailsDto,
    CollectionMemberDto,
} from '../../../../../packages/contracts/src/http';
import { CollectionCovers } from './collection-covers.util';

function member(id: string, overrides: Partial<CollectionMemberDto> = {}): CollectionMemberDto {
    return {
        id,
        title: id,
        isbn: null,
        publisher: null,
        category: 'manga',
        ownership: 'owned',
        hasCover: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
        volumeFrom: 1,
        volumeTo: 1,
        ...overrides,
    };
}

function collection(volumes: CollectionDetailsDto['volumes']): CollectionDetailsDto {
    return {
        id: 'c1',
        name: 'Gunnm',
        includesVolumeZero: false,
        finished: false,
        bookCount: 4,
        expectedFrom: 1,
        expectedTo: 7,
        expectedCount: 7,
        ownedCount: 3,
        missingCount: 4,
        lastOwned: 2,
        previews: [],
        volumes,
    };
}

const omnibus = member('omnibus', { volumeFrom: 1, volumeTo: 2 });
const seven = member('seven', { ownership: 'not-owned', volumeFrom: 7, volumeTo: 7 });
const gunnm = collection([
    { from: 1, to: 1, state: 'owned', books: [member('one'), omnibus] },
    {
        from: 2,
        to: 2,
        state: 'owned',
        books: [omnibus, member('two', { volumeFrom: 2, volumeTo: 2 })],
    },
    { from: 3, to: 3, state: 'owned', books: [member('three', { volumeFrom: 3, volumeTo: 3 })] },
    { from: 4, to: 6, state: 'inferred', books: [] },
    { from: 7, to: 7, state: 'planned', books: [seven] },
]);

it('lists each book of the collection once, in volume order', () => {
    const subject = gunnm;

    const result = CollectionCovers.books(subject).map((book) => book.id);

    expect(result).toEqual(['omnibus', 'one', 'two', 'three', 'seven']);
});

it('places each missing volume in its own slot, in volume order', () => {
    const subject = gunnm;

    const result = CollectionCovers.slots(subject).map((slot) =>
        slot.kind === 'book' ? slot.book.id : 'missing ' + slot.volume,
    );

    expect(result).toEqual([
        'omnibus',
        'one',
        'two',
        'three',
        'missing 4',
        'missing 5',
        'missing 6',
        'seven',
    ]);
});

it('gives a planned volume its saved book rather than a missing slot', () => {
    const subject = collection([{ from: 1, to: 1, state: 'planned', books: [seven] }]);

    const result = CollectionCovers.slots(subject);

    expect(result).toEqual([{ kind: 'book', book: seven }]);
});
