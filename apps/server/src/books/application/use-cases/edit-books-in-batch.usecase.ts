import type { EditBooksInBatchUseCase } from '../ports/driving/edit-books-in-batch-use-case.interface.js';
import { BookAudit } from '../book-audit.js';
import type { BookBatchFields, BookBatchRequest, BookBatchView } from '../book-batch.js';
import { bookBatchDetailFields } from '../book-batch.js';
import type { AuthorMatch } from '../book-input.js';
import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { CollectionMembership } from '../ports/driven/collection-membership.interface.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import type { AuthorResolver } from '../services/author-resolver.service.js';
import type {
    BookBatchPlan,
    BookBatchPlanner,
    PlannedBook,
} from '../services/book-batch-planner.service.js';
import type { BookOrganiser } from '../services/book-organiser.service.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class EditBooksInBatch implements EditBooksInBatchUseCase {
    constructor(
        private readonly planner: BookBatchPlanner,
        private readonly resolver: AuthorResolver,
        private readonly books: BookRepository,
        private readonly authors: AuthorRepository,
        private readonly collections: CollectionMembership,
        private readonly organiser: BookOrganiser,
        private readonly readings: ReadingStatusStore,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, request: BookBatchRequest): Promise<BookBatchView> {
        if (request.preview) {
            ActorAuthorization.requireLibraryEditor(actor);
            const choices = request.changes.authors;
            const authors = choices ? await this.resolver.match(choices) : null;

            return EditBooksInBatch.view(
                await this.planner.plan(actor.id, request, authors),
                false,
            );
        }

        return this.operations.run(
            {
                category: BookAudit.batchEdited,
                actorId: actor.id,
                subjectType: BookAudit.collection,
                subjectId: request.collectionId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const authors = await this.resolvedAuthors(request);
                const plan = await this.planner.plan(actor.id, request, authors);
                const related: RelatedChange[] = [];

                for (const planned of plan.planned) {
                    related.push(...(await this.apply(actor, planned)));
                }

                await this.authors.removeUnlinked([
                    ...plan.planned.flatMap((planned) => planned.previousAuthorIds),
                    ...(authors ?? []).flatMap((author) => author.id ?? []),
                ]);

                return {
                    result: EditBooksInBatch.view(plan, true),
                    before: { name: plan.collection.name, bookIds: [...request.bookIds] },
                    after: {
                        name: plan.collection.name,
                        edited: plan.planned
                            .filter((planned) => EditBooksInBatch.changed(planned))
                            .map((planned) => planned.book.id),
                        skipped: plan.skipped.map((skip) => ({ id: skip.id, reason: skip.reason })),
                    },
                    related,
                };
            },
        );
    }

    private async resolvedAuthors(request: BookBatchRequest): Promise<AuthorMatch[] | null> {
        const choices = request.changes.authors;

        if (!choices) {
            return null;
        }

        const ids = await this.resolver.resolve(choices);

        return this.resolver.match(ids.map((id) => ({ id })));
    }

    private async apply(actor: Actor, planned: PlannedBook): Promise<RelatedChange[]> {
        const { book, collection } = planned;
        const related: RelatedChange[] = [];

        if (planned.detailsChanged) {
            await this.books.save(book);
            related.push(EditBooksInBatch.bookChange(planned));
        }

        if (planned.ownershipChanged) {
            const membership = await this.collections.assign(
                {
                    id: book.id,
                    ownership: book.details.ownership,
                    category: book.details.category,
                },
                {
                    collection: { id: collection.id },
                    volumeFrom: collection.volumeFrom,
                    volumeTo: collection.volumeTo,
                },
                [],
            );

            related.push(...membership.changes);
        }

        if (planned.organisation) {
            const organised = await this.organiser.apply(book.id, planned.organisation);

            related.push(
                EditBooksInBatch.change(BookAudit.organised, planned, ['location', 'tags']),
            );
            related.push(...organised.changes);
        }

        if (planned.read !== null) {
            await this.readings.set(actor.id, book.id, planned.read);
            related.push({
                category: BookAudit.readingStatusChanged,
                subjectType: BookAudit.book,
                subjectId: book.id,
                before: { read: !planned.read },
                after: { read: planned.read },
            });
        }

        return related;
    }

    private static bookChange(planned: PlannedBook): RelatedChange {
        return EditBooksInBatch.change(BookAudit.updated, planned, bookBatchDetailFields);
    }

    private static change(
        category: string,
        planned: PlannedBook,
        fields: readonly (keyof BookBatchFields)[],
    ): RelatedChange {
        const { book, entry } = planned;

        return {
            category,
            subjectType: BookAudit.book,
            subjectId: book.id,
            before: { title: entry.title, ...EditBooksInBatch.only(entry.before, fields) },
            after: { title: book.details.title, ...EditBooksInBatch.only(entry.after, fields) },
        };
    }

    private static only(
        fields: BookBatchFields,
        keys: readonly (keyof BookBatchFields)[],
    ): Record<string, unknown> {
        return Object.fromEntries(
            keys.filter((key) => key in fields).map((key) => [key, fields[key]]),
        );
    }

    private static changed(planned: PlannedBook): boolean {
        return Object.keys(planned.entry.after).length > 0;
    }

    private static view(plan: BookBatchPlan, saved: boolean): BookBatchView {
        return {
            collection: plan.collection,
            saved,
            books: plan.planned.map((planned) => planned.entry),
            skipped: plan.skipped,
        };
    }
}
