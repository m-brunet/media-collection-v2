import { expect, it } from 'vitest';
import { CollectionCoverage } from './collection-coverage.value-object.js';
import type { CoverageMember, MemberOwnership } from './collection-coverage.value-object.js';
import { VolumeRange } from './volume-range.value-object.js';

function member(
    bookId: string,
    ownership: MemberOwnership,
    from: number,
    to = from,
): CoverageMember {
    return { bookId, ownership, range: VolumeRange.of(from, to) };
}

it('infers the missing volumes below a single Owned volume 20', () => {
    const members = [member('a', 'owned', 20)];

    const coverage = CollectionCoverage.of(false, members);

    expect(coverage.expected).toBe(20);
    expect(coverage.missing).toEqual([...Array(19).keys()].map((index) => index + 1));
    expect(coverage.lastOwned).toBe(20);
});

it('counts a saved Not Owned volume as missing and keeps the last Owned volume', () => {
    const members = [member('a', 'owned', 5), member('b', 'not-owned', 10)];

    const coverage = CollectionCoverage.of(false, members);

    expect(coverage.expected).toBe(10);
    expect(coverage.missing).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 10]);
    expect(coverage.lastOwned).toBe(5);
    expect(coverage.volumes().at(-1)).toEqual({
        from: 10,
        to: 10,
        state: 'planned',
        bookIds: ['b'],
    });
});

it('includes an uncovered volume 0 in the missing volumes once enabled', () => {
    const members = [member('a', 'owned', 1, 2)];

    const coverage = CollectionCoverage.of(true, members);

    expect(coverage.start).toBe(0);
    expect(coverage.expected).toBe(3);
    expect(coverage.missing).toEqual([0]);
});

it('ends the expected range at the highest remaining coverage', () => {
    const members = [member('a', 'owned', 1, 19)];

    const coverage = CollectionCoverage.of(false, members);

    expect(coverage.highest).toBe(19);
    expect(coverage.expected).toBe(19);
    expect(coverage.missing).toEqual([]);
});

it('counts distinct Owned volumes rather than editions', () => {
    const members = [
        member('one', 'owned', 1),
        member('two', 'owned', 2),
        member('paperback', 'owned', 3),
        member('hardcover', 'owned', 3),
        member('five', 'owned', 5),
    ];

    const coverage = CollectionCoverage.of(false, members);

    expect(coverage.ownedVolumes).toBe(4);
    expect(coverage.expected).toBe(5);
    expect(coverage.missing).toEqual([4]);
});

it('adds no completeness for an Owned edition overlapping an Owned omnibus', () => {
    const members = [member('omnibus', 'owned', 1, 3), member('two', 'owned', 2)];

    const coverage = CollectionCoverage.of(false, members);

    expect(coverage.ownedVolumes).toBe(3);
    expect(coverage.expected).toBe(3);
});

it('raises the expected range to a Not Owned omnibus end', () => {
    const members = [member('one', 'owned', 1), member('omnibus', 'not-owned', 2, 6)];

    const coverage = CollectionCoverage.of(false, members);

    expect(coverage.highest).toBe(6);
    expect(coverage.missing).toEqual([2, 3, 4, 5, 6]);
});

it('takes the last Owned volume from an omnibus range end', () => {
    const members = [member('omnibus', 'owned', 1, 3), member('five', 'not-owned', 5)];

    const coverage = CollectionCoverage.of(false, members);

    expect(coverage.lastOwned).toBe(3);
});

it('has no last Owned volume without Owned books', () => {
    const members = [member('a', 'not-owned', 2)];

    const coverage = CollectionCoverage.of(false, members);

    expect(coverage.lastOwned).toBeNull();
});

it('groups consecutive inferred volumes into one entry', () => {
    const members = [member('one', 'owned', 1), member('twelve', 'not-owned', 12)];

    const coverage = CollectionCoverage.of(false, members);

    expect(coverage.volumes()).toEqual([
        { from: 1, to: 1, state: 'owned', bookIds: ['one'] },
        { from: 2, to: 11, state: 'inferred', bookIds: [] },
        { from: 12, to: 12, state: 'planned', bookIds: ['twelve'] },
    ]);
});

it('lists every edition covering a volume', () => {
    const members = [member('year-one', 'owned', 1), member('omnibus', 'owned', 1, 3)];

    const coverage = CollectionCoverage.of(false, members);

    expect(coverage.volumes()[0]).toEqual({
        from: 1,
        to: 1,
        state: 'owned',
        bookIds: ['year-one', 'omnibus'],
    });
});

it('allows Owned books to overlap', () => {
    const coverage = CollectionCoverage.of(false, [member('omnibus', 'owned', 1, 3)]);

    const conflicts = coverage.conflictsWith(member('new', 'owned', 2));

    expect(conflicts).toEqual([]);
});

it('blocks a Not Owned volume inside an Owned omnibus', () => {
    const coverage = CollectionCoverage.of(false, [member('omnibus', 'owned', 1, 3)]);

    const conflicts = coverage.conflictsWith(member('new', 'not-owned', 2));

    expect(conflicts.map((conflict) => conflict.bookId)).toEqual(['omnibus']);
});

it('blocks a Not Owned omnibus over an Owned volume', () => {
    const coverage = CollectionCoverage.of(false, [member('two', 'owned', 2)]);

    const conflicts = coverage.conflictsWith(member('new', 'not-owned', 1, 3));

    expect(conflicts.map((conflict) => conflict.bookId)).toEqual(['two']);
});

it('blocks two overlapping Not Owned books', () => {
    const coverage = CollectionCoverage.of(false, [member('planned', 'not-owned', 4)]);

    const conflicts = coverage.conflictsWith(member('new', 'not-owned', 4));

    expect(conflicts.map((conflict) => conflict.bookId)).toEqual(['planned']);
});

it('reports every planned book an Owned omnibus overlaps', () => {
    const coverage = CollectionCoverage.of(false, [
        member('one', 'not-owned', 1),
        member('two', 'not-owned', 2),
        member('three', 'not-owned', 3),
        member('four', 'not-owned', 4),
    ]);

    const conflicts = coverage.conflictsWith(member('new', 'owned', 1, 3));

    expect(conflicts.map((conflict) => conflict.bookId)).toEqual(['one', 'two', 'three']);
});

it('ignores the saved coverage of the book being changed', () => {
    const coverage = CollectionCoverage.of(false, [member('book', 'owned', 2)]);

    const conflicts = coverage.conflictsWith(member('book', 'not-owned', 2));

    expect(conflicts).toEqual([]);
});

it('detects a saved book covering volume 0', () => {
    const members = [member('zero', 'owned', 0)];

    const coverage = CollectionCoverage.of(true, members);

    expect(coverage.coversVolumeZero).toBe(true);
});

it('leaves out of the uncovered volumes every number a book covers, whatever its ownership', () => {
    const members = [
        member('a', 'owned', 1),
        member('b', 'owned', 2),
        member('c', 'not-owned', 5),
        member('d', 'owned', 7, 8),
    ];

    const coverage = CollectionCoverage.of(false, members);

    expect(coverage.uncovered(10)).toEqual([3, 4, 6, 9, 10]);
});

it('starts the uncovered volumes at 0 for a collection with a volume 0', () => {
    const members = [member('a', 'owned', 1)];

    const coverage = CollectionCoverage.of(true, members);

    expect(coverage.uncovered(3)).toEqual([0, 2, 3]);
});
