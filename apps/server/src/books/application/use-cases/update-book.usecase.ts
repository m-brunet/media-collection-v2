import type { UpdateBookUseCase } from '../ports/driving/update-book-use-case.interface.js';
import type { BookInput } from '../book-input.js';
import type { BookView } from '../book-views.js';
import { BookAudit, BookSnapshot } from '../book-audit.js';
import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import { BookDetailsBuilder } from '../services/book-details-builder.service.js';
import { BookIdentityCheck } from '../services/book-identity-check.service.js';
import { BookLoader } from '../services/book-loader.service.js';
import { BookViewer } from '../services/book-viewer.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// Edits shared book information. Authors no longer linked to any book disappear.
export class UpdateBook implements UpdateBookUseCase {
    constructor(
        private readonly books: BookRepository,
        private readonly authors: AuthorRepository,
        private readonly loader: BookLoader,
        private readonly builder: BookDetailsBuilder,
        private readonly identity: BookIdentityCheck,
        private readonly viewer: BookViewer,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, bookId: string, input: BookInput): Promise<BookView> {
        return this.operations.run(
            {
                category: BookAudit.updated,
                actorId: actor.id,
                subjectType: BookAudit.book,
                subjectId: bookId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const book = await this.loader.load(bookId);
                const before = BookSnapshot.of(book);
                const previousAuthors = book.details.authorIds;
                const details = await this.builder.build(input);

                await this.identity.ensureUnique(details, bookId, input.confirmDistinct ?? false);
                book.edit(details, this.clock.now().toISOString());
                await this.books.save(book);
                await this.authors.removeUnlinked(previousAuthors);

                return {
                    result: await this.viewer.view(book, actor),
                    before,
                    after: BookSnapshot.of(book),
                };
            },
        );
    }
}
