import type { ReplaceCoverUseCase } from '../ports/driving/replace-cover-use-case.interface.js';
import type { BookView } from '../book-views.js';
import { BookAudit } from '../book-audit.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { CoverStorage } from '../ports/driven/cover-storage.interface.js';
import type { CoverTrimmer } from '../ports/driven/cover-trimmer.interface.js';
import { BookLoader } from '../services/book-loader.service.js';
import { BookViewer } from '../services/book-viewer.service.js';
import { CoverImage } from '../../domain/value-objects/cover-image.value-object.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class ReplaceCover implements ReplaceCoverUseCase {
    constructor(
        private readonly books: BookRepository,
        private readonly covers: CoverStorage,
        private readonly trimmer: CoverTrimmer,
        private readonly loader: BookLoader,
        private readonly viewer: BookViewer,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, bookId: string, image: Uint8Array): Promise<BookView> {
        let stored: string | null = null;
        let replaced: string | null = null;

        try {
            const view = await this.operations.run(
                {
                    category: BookAudit.coverChanged,
                    actorId: actor.id,
                    subjectType: BookAudit.book,
                    subjectId: bookId,
                },
                async () => {
                    ActorAuthorization.requireLibraryEditor(actor);
                    // Shop padding is removed before storing; see the book entry rules.
                    const cover = await this.trimmer.trim(CoverImage.from(image));
                    const book = await this.loader.load(bookId);

                    replaced = book.snapshot.coverFile;
                    stored = await this.covers.store(cover.bytes, cover.mediaType);
                    book.replaceCover(stored, this.clock.now().toISOString());
                    await this.books.save(book);

                    return {
                        result: await this.viewer.view(book, actor),
                        before: { hasCover: replaced !== null },
                        after: { hasCover: true },
                    };
                },
            );

            if (replaced) {
                await this.covers.remove(replaced);
            }

            return view;
        } catch (error) {
            // The new image is not referenced by any book after a failure.
            if (stored) {
                await this.covers.remove(stored);
            }

            throw error;
        }
    }
}
