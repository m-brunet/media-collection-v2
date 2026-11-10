import type { RemoveCoverUseCase } from '../ports/driving/remove-cover-use-case.interface.js';
import type { BookView } from '../book-views.js';
import { BookAudit } from '../book-audit.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { CoverStorage } from '../ports/driven/cover-storage.interface.js';
import { BookLoader } from '../services/book-loader.service.js';
import { BookViewer } from '../services/book-viewer.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class RemoveCover implements RemoveCoverUseCase {
    constructor(
        private readonly books: BookRepository,
        private readonly covers: CoverStorage,
        private readonly loader: BookLoader,
        private readonly viewer: BookViewer,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, bookId: string): Promise<BookView> {
        let removed: string | null = null;
        const view = await this.operations.run(
            {
                category: BookAudit.coverChanged,
                actorId: actor.id,
                subjectType: BookAudit.book,
                subjectId: bookId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const book = await this.loader.load(bookId);

                removed = book.snapshot.coverFile;
                book.replaceCover(null, this.clock.now().toISOString());
                await this.books.save(book);

                return {
                    result: await this.viewer.view(book, actor),
                    before: { title: book.snapshot.details.title, hasCover: removed !== null },
                    after: { title: book.snapshot.details.title, hasCover: false },
                };
            },
        );

        if (removed) {
            await this.covers.remove(removed);
        }

        return view;
    }
}
