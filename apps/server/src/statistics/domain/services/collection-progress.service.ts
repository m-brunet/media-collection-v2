import { Ranking } from './ranking.service.js';

export type StatisticsCategory = 'books' | 'manga' | 'comics';

export type CollectionProgressStatus = 'unfinished' | 'finished' | 'dropped';

export interface CollectionProgressEntry {
    id: string;
    name: string;
    category: StatisticsCategory;
    status: CollectionProgressStatus;
    ownedBooks: number;
    missingVolumes: number;
}

export interface CollectionProgressSummary<T extends CollectionProgressEntry> {
    finished: number;
    unfinished: number;
    dropped: number;
    missingVolumes: number;
    biggest: T | null;
}

export class CollectionProgress {
    static of<T extends CollectionProgressEntry>(
        tallies: readonly T[],
        category: StatisticsCategory | null,
    ): CollectionProgressSummary<T> {
        const chosen = tallies.filter((tally) => category === null || tally.category === category);
        const counted = (status: CollectionProgressStatus) =>
            chosen.filter((tally) => tally.status === status);
        const [biggest] = Ranking.top(
            chosen.filter((tally) => tally.ownedBooks > 0),
            (tally) => tally.ownedBooks,
        );

        return {
            finished: counted('finished').length,
            unfinished: counted('unfinished').length,
            dropped: counted('dropped').length,
            missingVolumes: chosen
                .filter((tally) => tally.status !== 'dropped')
                .reduce((total, tally) => total + tally.missingVolumes, 0),
            biggest: biggest ?? null,
        };
    }
}
