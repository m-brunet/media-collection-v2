import type { UpdateBookUseCase } from '../ports/driving/update-book-use-case.interface.js';
import type { BookInput } from '../book-input.js';
import type { BookView } from '../book-views.js';
import { BookAudit, BookSnapshot } from '../book-audit.js';
import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { BookCollectionReader } from '../ports/driven/book-collection-reader.interface.js';
import type { CollectionMembership } from '../ports/driven/collection-membership.interface.js';
import type { CoverStorage } from '../ports/driven/cover-storage.interface.js';
import { BookDetailsBuilder } from '../services/book-details-builder.service.js';
import { BookIdentityCheck } from '../services/book-identity-check.service.js';
import { BookLoader } from '../services/book-loader.service.js';
import { BookRemoval } from '../services/book-removal.service.js';
import { BookViewer } from '../services/book-viewer.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// Edits shared book information and collection membership. Coverage rules apply again, since
// ownership or volumes may change. Authors no longer linked to any book disappear.
export class UpdateBook implements UpdateBookUseCase {
    constructor(
        private readonly books: BookRepository,
        private readonly authors: AuthorRepository,
        private readonly collections: CollectionMembership,
        private readonly memberships: BookCollectionReader,
        private readonly removal: BookRemoval,
        private readonly covers: CoverStorage,
        private readonly loader: BookLoader,
        private readonly builder: BookDetailsBuilder,
        private readonly identity: BookIdentityCheck,
        private readonly viewer: BookViewer,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, bookId: string, input: BookInput): Promise<BookView> {
        const { view, replacedCovers } = await this.operations.run(
            {
                category: BookAudit.updated,
                actorId: actor.id,
                subjectType: BookAudit.book,
                subjectId: bookId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const book = await this.loader.load(bookId);
                const before = BookSnapshot.of(book, await this.memberships.of(bookId));
                const previousAuthors = book.details.authorIds;
                const details = await this.builder.build(input);
                const replacing = input.replacePlanned ?? [];

                await this.identity.ensureUnique(details, bookId, input.confirmDistinct ?? false);
                book.edit(details, this.clock.now().toISOString());
                await this.books.save(book);
                await this.authors.removeUnlinked(previousAuthors);
                const collection = await this.collections.assign(
                    { id: bookId, ownership: details.ownership },
                    input.collection,
                    replacing,
                );
                const replaced = [];

                for (const plannedId of replacing) {
                    replaced.push(await this.removal.remove(plannedId));
                }

                return {
                    result: {
                        view: await this.viewer.view(book, actor),
                        replacedCovers: replaced.flatMap(
                            (planned) => planned.snapshot.coverFile ?? [],
                        ),
                    },
                    before,
                    after: {
                        ...BookSnapshot.of(book, collection),
                        ...(replaced.length > 0
                            ? {
                                  replacedPlanned: replaced.map((planned) =>
                                      BookSnapshot.of(planned),
                                  ),
                              }
                            : {}),
                    },
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
