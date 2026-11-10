import type { MarkBookOwnedUseCase } from '../ports/driving/mark-book-owned-use-case.interface.js';
import type { BookView } from '../book-views.js';
import { BookAudit, BookSnapshot } from '../book-audit.js';
import type { BookCollectionReader } from '../ports/driven/book-collection-reader.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import { BookLoader } from '../services/book-loader.service.js';
import { BookViewer } from '../services/book-viewer.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// Collection coverage needs no new check: a Not Owned book overlaps no other book of its
// collection, and Owned editions may overlap.
export class MarkBookOwned implements MarkBookOwnedUseCase {
    constructor(
        private readonly books: BookRepository,
        private readonly loader: BookLoader,
        private readonly memberships: BookCollectionReader,
        private readonly viewer: BookViewer,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, bookId: string): Promise<BookView> {
        return this.operations.run(
            {
                category: BookAudit.markedOwned,
                actorId: actor.id,
                subjectType: BookAudit.book,
                subjectId: bookId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const book = await this.loader.load(bookId);
                const collection = await this.memberships.of(bookId);
                const before = BookSnapshot.of(book, { collection });

                book.markOwned(this.clock.now().toISOString());
                await this.books.save(book);

                return {
                    result: await this.viewer.view(book, actor),
                    before,
                    after: BookSnapshot.of(book, { collection }),
                };
            },
        );
    }
}
