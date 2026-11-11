import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

// A source's spelling of an author replaced by an existing author's name.
export interface AuthorSpelling {
    // The existing author's name, filled in.
    name: string;
    // The source's spelling, which the person may still prefer.
    spelling: string;
    sources: string[];
}

// Finds the existing author a looked-up name stands for, with the rule the save applies: the
// same comparison key, or else a similar name ("Flipsflops" and "Flipflop's"). A name similar
// to several authors keeps its spelling: the save asks which one is meant.
export class AuthorMatcher {
    constructor(private readonly authors: AuthorRepository) {}

    // Each name with an existing author, mapped to that author's name.
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
