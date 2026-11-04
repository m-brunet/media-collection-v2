import type { FindAuthorsUseCase } from '../ports/driving/find-authors-use-case.interface.js';
import type { AuthorView } from '../book-views.js';
import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export class FindAuthors implements FindAuthorsUseCase {
    private static readonly limit = 10;

    constructor(private readonly authors: AuthorRepository) {}

    async execute(actor: Actor, search: string): Promise<AuthorView[]> {
        ActorAuthorization.requireReady(actor);
        const key = NameKey.of(search);

        return (await this.authors.list())
            .filter((author) => key.length > 0 && author.key.includes(key))
            .slice(0, FindAuthors.limit)
            .map((author) => ({ id: author.snapshot.id, name: author.snapshot.name }));
    }
}
