export interface Ranked {
    name: string;
}

export class Ranking {
    static readonly size = 10;

    static top<T extends Ranked>(entries: readonly T[], value: (entry: T) => number): T[] {
        return [...entries]
            .sort((a, b) => value(b) - value(a) || Ranking.byName(a, b))
            .slice(0, Ranking.size);
    }

    static byName(a: Ranked, b: Ranked): number {
        return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    }
}
