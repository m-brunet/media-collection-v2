import type { CreateBookUseCase } from '../ports/driving/create-book-use-case.interface.js';
import type { BookInput } from '../book-input.js';
import type { BookView } from '../book-views.js';
import { BookAudit, BookSnapshot } from '../book-audit.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { CollectionMembership } from '../ports/driven/collection-membership.interface.js';
import type { CoverStorage } from '../ports/driven/cover-storage.interface.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import { BookDetailsBuilder } from '../services/book-details-builder.service.js';
import { BookIdentityCheck } from '../services/book-identity-check.service.js';
import { BookRemoval } from '../services/book-removal.service.js';
import { BookViewer } from '../services/book-viewer.service.js';
import { Book } from '../../domain/entities/book.entity.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// Saves a new edition, with its collection membership. A purchased Owned book may replace the
// planned Not Owned books it overlaps, when the person explicitly chose to delete them.
export class CreateBook implements CreateBookUseCase {
    constructor(
        private readonly books: BookRepository,
        private readonly builder: BookDetailsBuilder,
        private readonly identity: BookIdentityCheck,
        private readonly collections: CollectionMembership,
        private readonly removal: BookRemoval,
        private readonly readings: ReadingStatusStore,
        private readonly covers: CoverStorage,
        private readonly viewer: BookViewer,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, input: BookInput, read: boolean): Promise<BookView> {
        const { view, replacedCovers } = await this.operations.run(
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
                const replacing = input.replacePlanned ?? [];

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
                const membership = await this.collections.assign(
                    { id, ownership: details.ownership },
                    input.collection,
                    replacing,
                );
                const replaced = [];

                for (const plannedId of replacing) {
                    replaced.push(await this.removal.remove(plannedId));
                }

                if (read) {
                    await this.readings.set(actor.id, id, true);
                }

                return {
                    result: {
                        view: await this.viewer.view(book, actor),
                        replacedCovers: replaced.flatMap(
                            (planned) => planned.book.snapshot.coverFile ?? [],
                        ),
                    },
                    before: null,
                    after: {
                        ...BookSnapshot.of(book, membership.collection),
                        ...(replaced.length > 0
                            ? {
                                  replacedPlanned: replaced.map((planned) =>
                                      BookSnapshot.of(planned.book),
                                  ),
                              }
                            : {}),
                    },
                    related: [
                        ...membership.changes,
                        ...replaced.flatMap((planned) => planned.changes),
                    ],
                };
            },
        );

        // Only once the replacement is committed: a failed save keeps the planned covers.
        for (const file of replacedCovers) {
            await this.covers.remove(file);
        }

        return view;
    }
}
