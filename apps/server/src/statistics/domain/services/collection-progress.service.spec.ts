import { describe, expect, it } from 'vitest';
import type { CollectionProgressEntry } from './collection-progress.service.js';
import { CollectionProgress } from './collection-progress.service.js';

function tally(
    name: string,
    values: Partial<CollectionProgressEntry> = {},
): CollectionProgressEntry {
    return {
        id: name,
        name,
        category: 'manga',
        status: 'unfinished',
        ownedBooks: 1,
        missingVolumes: 0,
        ...values,
    };
}

describe('CollectionProgress', () => {
    it('counts every collection when no category is chosen', () => {
        const tallies = [
            tally('One Piece', { status: 'finished' }),
            tally('Asterix', { category: 'comics', missingVolumes: 4 }),
        ];

        const summary = CollectionProgress.of(tallies, null);

        expect(summary).toMatchObject({ finished: 1, unfinished: 1, missingVolumes: 4 });
    });
    it('counts a dropped collection apart, without its missing volumes', () => {
        const tallies = [
            tally('One Piece', { status: 'finished' }),
            tally('Naruto', { missingVolumes: 2 }),
            tally('Bleach', { status: 'dropped', missingVolumes: 40 }),
        ];

        const summary = CollectionProgress.of(tallies, null);

        expect(summary).toMatchObject({
            finished: 1,
            unfinished: 1,
            dropped: 1,
            missingVolumes: 2,
        });
    });
    it('keeps a dropped collection as the biggest one', () => {
        const tallies = [
            tally('Naruto', { ownedBooks: 3 }),
            tally('Bleach', { status: 'dropped', ownedBooks: 40 }),
        ];

        const summary = CollectionProgress.of(tallies, null);

        expect(summary.biggest?.name).toBe('Bleach');
    });
    it('counts nothing for a category without collections', () => {
        const tallies = [tally('One Piece', { missingVolumes: 2 })];

        const summary = CollectionProgress.of(tallies, 'books');

        expect(summary).toEqual({
            finished: 0,
            unfinished: 0,
            dropped: 0,
            missingVolumes: 0,
            biggest: null,
        });
    });
});
