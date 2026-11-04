import type { SetReadingStatusUseCase } from '../ports/driving/set-reading-status-use-case.interface.js';
import { BookAudit } from '../book-audit.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import { BookLoader } from '../services/book-loader.service.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// Personal Read / Not read for Owners and the administrator; never shown in shared Activity.
export class SetReadingStatus implements SetReadingStatusUseCase {
    constructor(
        private readonly readings: ReadingStatusStore,
        private readonly loader: BookLoader,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, bookId: string, read: boolean): Promise<{ read: boolean }> {
        return this.operations.run(
            {
                category: BookAudit.readingStatusChanged,
                actorId: actor.id,
                subjectType: BookAudit.book,
                subjectId: bookId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                await this.loader.load(bookId);
                const before = await this.readings.isRead(actor.id, bookId);

                await this.readings.set(actor.id, bookId, read);

                return { result: { read }, before: { read: before }, after: { read } };
            },
        );
    }
}
