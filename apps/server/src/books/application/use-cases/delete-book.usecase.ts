import type { DeleteBookUseCase } from '../ports/driving/delete-book-use-case.interface.js';
import { BookAudit, BookSnapshot } from '../book-audit.js';
import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { CoverStorage } from '../ports/driven/cover-storage.interface.js';
import { BookLoader } from '../services/book-loader.service.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// Deletes an edition with everyone's reading status and notes on it, its cover, and the
// authors linked to no other book.
export class DeleteBook implements DeleteBookUseCase {
    constructor(
        private readonly books: BookRepository,
        private readonly authors: AuthorRepository,
        private readonly covers: CoverStorage,
        private readonly loader: BookLoader,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, bookId: string): Promise<void> {
        const cover = await this.operations.run(
            {
                category: BookAudit.deleted,
                actorId: actor.id,
                subjectType: BookAudit.book,
                subjectId: bookId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const book = await this.loader.load(bookId);

                await this.books.delete(bookId);
                await this.authors.removeUnlinked(book.details.authorIds);

                return {
                    result: book.snapshot.coverFile,
                    before: BookSnapshot.of(book),
                    after: null,
                };
            },
        );

        // Only once the deletion is committed: a failed deletion keeps its cover.
        if (cover) {
            await this.covers.remove(cover);
        }
    }
}
