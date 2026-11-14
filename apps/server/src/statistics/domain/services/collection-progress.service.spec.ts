import { describe, expect, it } from 'vitest';
import type { CollectionTally } from './collection-progress.service.js';
import { CollectionProgress } from './collection-progress.service.js';

function tally(name: string, values: Partial<CollectionTally> = {}): CollectionTally {
    return {
        id: name,
        name,
        category: 'manga',
        finished: false,
        ownedBooks: 1,
        missingVolumes: 0,
        ...values,
    };
}

describe('CollectionProgress', () => {
    it('counts every collection when no category is chosen', () => {
        const tallies = [
            tally('One Piece', { finished: true }),
            tally('Asterix', { category: 'comics', missingVolumes: 4 }),
        ];

        const summary = CollectionProgress.of(tallies, null);

        expect(summary).toMatchObject({ finished: 1, unfinished: 1, missingVolumes: 4 });
    });
    it('counts nothing for a category without collections', () => {
        const tallies = [tally('One Piece', { missingVolumes: 2 })];

        const summary = CollectionProgress.of(tallies, 'books');

        expect(summary).toEqual({ finished: 0, unfinished: 0, missingVolumes: 0, biggest: null });
    });
});
