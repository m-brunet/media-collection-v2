import { Ranking } from './ranking.service.js';

export type StatisticsCategory = 'books' | 'manga' | 'comics';

export interface CollectionProgressEntry {
    id: string;
    name: string;
    category: StatisticsCategory;
    finished: boolean;
    ownedBooks: number;
    missingVolumes: number;
}

export interface CollectionProgressSummary<T extends CollectionProgressEntry> {
    finished: number;
    unfinished: number;
    missingVolumes: number;
    biggest: T | null;
}

export class CollectionProgress {
    static of<T extends CollectionProgressEntry>(
        tallies: readonly T[],
        category: StatisticsCategory | null,
    ): CollectionProgressSummary<T> {
        const chosen = tallies.filter((tally) => category === null || tally.category === category);
        const finished = chosen.filter((tally) => tally.finished).length;
        const [biggest] = Ranking.top(
            chosen.filter((tally) => tally.ownedBooks > 0),
            (tally) => tally.ownedBooks,
        );

        return {
            finished,
            unfinished: chosen.length - finished,
            missingVolumes: chosen.reduce((total, tally) => total + tally.missingVolumes, 0),
            biggest: biggest ?? null,
        };
    }
}
