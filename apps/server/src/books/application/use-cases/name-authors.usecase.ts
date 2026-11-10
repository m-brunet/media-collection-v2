import type { NameAuthorsUseCase } from '../ports/driving/name-authors-use-case.interface.js';
import type { AuthorView } from '../book-views.js';
import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class NameAuthors implements NameAuthorsUseCase {
    constructor(private readonly authors: AuthorRepository) {}

    async execute(actor: Actor, ids: readonly string[]): Promise<AuthorView[]> {
        ActorAuthorization.requireReady(actor);

        return (await this.authors.findByIds(ids))
            .map((author) => ({ id: author.snapshot.id, name: author.snapshot.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }
}
