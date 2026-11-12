import type { SetCollectionReadingUseCase } from '../ports/driving/set-collection-reading-use-case.interface.js';
import { BookAudit } from '../book-audit.js';
import type { CollectionReadingView } from '../book-views.js';
import type { CollectionOwnedBooks } from '../ports/driven/collection-owned-books.interface.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import { CollectionReading } from '../../domain/value-objects/collection-reading.value-object.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class SetCollectionReading implements SetCollectionReadingUseCase {
    constructor(
        private readonly collections: CollectionOwnedBooks,
        private readonly readings: ReadingStatusStore,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(
        actor: Actor,
        collectionId: string,
        read: boolean,
    ): Promise<CollectionReadingView> {
        return this.operations.run(
            {
                category: BookAudit.collectionReadingChanged,
                actorId: actor.id,
                subjectType: BookAudit.collection,
                subjectId: collectionId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const owned = await this.collections.of(collectionId);
                const before = CollectionReading.of(
                    owned,
                    await this.readings.readAmong(actor.id, owned),
                );
                const changed = before.booksToMark(read);

                for (const bookId of changed) {
                    await this.readings.set(actor.id, bookId, read);
                }

                const after = before.marked(read);

                return {
                    result: after.view,
                    before: before.view,
                    after: after.view,
                    related: changed.map((bookId) => ({
                        category: BookAudit.readingStatusChanged,
                        subjectType: BookAudit.book,
                        subjectId: bookId,
                        before: { read: !read },
                        after: { read },
                    })),
                };
            },
        );
    }
}
