import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export interface AuthorSpelling {
    name: string;
    spelling: string;
    sources: string[];
}

export class AuthorMatcher {
    constructor(private readonly authors: AuthorRepository) {}

    async existing(names: readonly string[]): Promise<Map<string, string>> {
        const matches = new Map<string, string>();

        if (names.length === 0) {
            return matches;
        }

        const known = (await this.authors.list()).map((author) => author.snapshot.name);

        for (const name of names) {
            const key = NameKey.of(name);
            const same = known.find((existing) => NameKey.of(existing) === key);
            const similar = known.filter((existing) => NameKey.similar(existing, name));
            const match = same ?? (similar.length === 1 ? similar[0] : undefined);

            if (match !== undefined) {
                matches.set(name, match);
            }
        }

        return matches;
    }
}
