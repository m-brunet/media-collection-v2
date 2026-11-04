import type { CorrectAuthorUseCase } from '../ports/driving/correct-author-use-case.interface.js';
import type { AuthorView } from '../book-views.js';
import { BookAudit } from '../book-audit.js';
import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

// A shared spelling correction: every book linked to the author shows the new name. Renaming to
// another author's equivalent name is refused (merging authors is not available).
export class CorrectAuthor implements CorrectAuthorUseCase {
    constructor(
        private readonly authors: AuthorRepository,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, authorId: string, name: string): Promise<AuthorView> {
        return this.operations.run(
            {
                category: BookAudit.authorCorrected,
                actorId: actor.id,
                subjectType: BookAudit.author,
                subjectId: authorId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const author = await this.authors.findById(authorId);

                if (!author) {
                    throw new Failure(
                        'not_found',
                        'That author no longer exists.',
                        'author-missing',
                    );
                }

                const before = author.snapshot.name;
                const other = await this.authors.findByKey(NameKey.of(name));

                if (other && other.snapshot.id !== authorId) {
                    throw new Failure(
                        'conflict',
                        'Another author already has an equivalent name.',
                        'author-name-taken',
                    );
                }

                author.correct(name);
                await this.authors.save(author);

                return {
                    result: { id: authorId, name: author.snapshot.name },
                    before: { name: before },
                    after: { name: author.snapshot.name },
                };
            },
        );
    }
}
