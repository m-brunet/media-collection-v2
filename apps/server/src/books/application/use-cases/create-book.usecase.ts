import type { CreateBookUseCase } from '../ports/driving/create-book-use-case.interface.js';
import type { BookInput } from '../book-input.js';
import type { BookView } from '../book-views.js';
import { BookAudit, BookSnapshot } from '../book-audit.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import { BookDetailsBuilder } from '../services/book-details-builder.service.js';
import { BookIdentityCheck } from '../services/book-identity-check.service.js';
import { BookViewer } from '../services/book-viewer.service.js';
import { Book } from '../../domain/entities/book.entity.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class CreateBook implements CreateBookUseCase {
    constructor(
        private readonly books: BookRepository,
        private readonly builder: BookDetailsBuilder,
        private readonly identity: BookIdentityCheck,
        private readonly readings: ReadingStatusStore,
        private readonly viewer: BookViewer,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, input: BookInput, read: boolean): Promise<BookView> {
        return this.operations.run(
            {
                category: BookAudit.created,
                actorId: actor.id,
                subjectType: BookAudit.book,
                subjectId: null,
            },
            async (context) => {
                ActorAuthorization.requireLibraryEditor(actor);
                const id = this.ids.next();
                const now = this.clock.now().toISOString();
                const details = await this.builder.build(input);

                await this.identity.ensureUnique(details, id, input.confirmDistinct ?? false);
                const book = new Book({
                    id,
                    details,
                    coverFile: null,
                    createdAt: now,
                    updatedAt: now,
                });

                context.subjectId = id;
                await this.books.create(book);

                if (read) {
                    await this.readings.set(actor.id, id, true);
                }

                return {
                    result: await this.viewer.view(book, actor),
                    before: null,
                    after: BookSnapshot.of(book),
                };
            },
        );
    }
}
