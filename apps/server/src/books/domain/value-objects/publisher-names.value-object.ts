import { NameKey } from '../../../shared/domain/name-key.helper.js';

export interface PublisherUsage {
    name: string;
    books: number;
}

export class PublisherNames {
    private constructor(private readonly spellings: ReadonlyMap<string, string>) {}

    static of(usages: readonly PublisherUsage[]): PublisherNames {
        const counts = new Map<string, number>();

        for (const usage of usages) {
            const name = usage.name.trim();

            if (NameKey.of(name).length > 0) {
                counts.set(name, (counts.get(name) ?? 0) + usage.books);
            }
        }

        const chosen = new Map<string, PublisherUsage>();

        for (const [name, books] of counts) {
            const key = NameKey.of(name);
            const current = chosen.get(key);
            const candidate = { name, books };

            if (!current || PublisherNames.preferred(candidate, current)) {
                chosen.set(key, candidate);
            }
        }

        return new PublisherNames(
            new Map([...chosen].map(([key, usage]) => [key, usage.name] as const)),
        );
    }

    same(name: string): string | null {
        return this.spellings.get(NameKey.of(name)) ?? null;
    }

    similar(name: string): string[] {
        return [...this.spellings.values()]
            .filter((spelling) => NameKey.similar(spelling, name))
            .sort((a, b) => a.localeCompare(b));
    }

    search(text: string, limit: number): string[] {
        const typed = NameKey.words(text);

        if (typed.length === 0) {
            return [];
        }

        return [...this.spellings.values()]
            .map((name) => ({ name, words: NameKey.words(name) }))
            .filter(({ words }) => words.startsWith(typed) || words.includes(' ' + typed))
            .sort(
                (a, b) =>
                    Number(b.words.startsWith(typed)) - Number(a.words.startsWith(typed)) ||
                    a.name.localeCompare(b.name),
            )
            .slice(0, limit)
            .map(({ name }) => name);
    }

    private static preferred(candidate: PublisherUsage, current: PublisherUsage): boolean {
        return (
            candidate.books > current.books ||
            (candidate.books === current.books && candidate.name.localeCompare(current.name) < 0)
        );
    }
}
