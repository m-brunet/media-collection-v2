import type { AuthorChoice, AuthorMatch } from '../book-input.js';
import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import { Author } from '../../domain/entities/author.entity.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export class AuthorResolver {
    constructor(
        private readonly authors: AuthorRepository,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async resolve(choices: AuthorChoice[]): Promise<string[]> {
        const resolved: string[] = [];

        for (const choice of choices) {
            resolved.push(
                'id' in choice ? (await this.existing(choice.id)).id : await this.named(choice),
            );
        }

        return resolved;
    }

    async match(choices: AuthorChoice[]): Promise<AuthorMatch[]> {
        const matches: AuthorMatch[] = [];

        for (const choice of choices) {
            if ('id' in choice) {
                matches.push(await this.existing(choice.id));
            } else {
                const name = Author.name(choice.name);

                matches.push((await this.equivalent(name, choice.distinct)) ?? { id: null, name });
            }
        }

        return matches;
    }

    private async existing(id: string): Promise<{ id: string; name: string }> {
        const author = await this.authors.findById(id);

        if (!author) {
            throw new Failure('not_found', 'That author no longer exists.', 'author-missing');
        }

        return { id, name: author.snapshot.name };
    }

    private async named(choice: { name: string; distinct?: boolean }): Promise<string> {
        const name = Author.name(choice.name);
        const equivalent = await this.equivalent(name, choice.distinct);

        if (equivalent) {
            return equivalent.id;
        }

        const author = new Author({
            id: this.ids.next(),
            name,
            createdAt: this.clock.now().toISOString(),
        });

        await this.authors.create(author);

        return author.snapshot.id;
    }

    private async equivalent(
        name: string,
        distinct: boolean | undefined,
    ): Promise<{ id: string; name: string } | null> {
        const equivalent = await this.authors.findByKey(NameKey.of(name));

        if (equivalent) {
            return { id: equivalent.snapshot.id, name: equivalent.snapshot.name };
        }

        if (!distinct) {
            const similar = (await this.authors.list()).filter((author) =>
                NameKey.similar(author.snapshot.name, name),
            );

            if (similar.length > 0) {
                throw new Failure(
                    'conflict',
                    'A similar author already exists.',
                    'author-similar',
                    {
                        name,
                        candidates: similar.map((author) => ({
                            id: author.snapshot.id,
                            name: author.snapshot.name,
                        })),
                    },
                );
            }
        }

        return null;
    }
}
