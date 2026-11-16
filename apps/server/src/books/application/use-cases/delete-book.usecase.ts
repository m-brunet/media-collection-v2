import type { DeleteBookUseCase } from '../ports/driving/delete-book-use-case.interface.js';
import { BookAudit, BookSnapshot } from '../book-audit.js';
import type { BookCollectionReader } from '../ports/driven/book-collection-reader.interface.js';
import { BookOrganisationReader } from '../services/book-organisation-reader.service.js';
import { BookRemoval } from '../services/book-removal.service.js';
import type { KeptCovers } from '../services/kept-covers.service.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class DeleteBook implements DeleteBookUseCase {
    constructor(
        private readonly removal: BookRemoval,
        private readonly collections: BookCollectionReader,
        private readonly organisation: BookOrganisationReader,
        private readonly kept: KeptCovers,
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
                const collection = await this.collections.of(bookId);
                const organisation = await this.organisation.current(bookId);
                const { book, changes } = await this.removal.remove(bookId);

                return {
                    result: {
                        file: book.snapshot.coverFile,
                        isbn13: book.snapshot.details.isbn?.isbn13 ?? null,
                    },
                    before: BookSnapshot.of(book, { collection, organisation }),
                    after: null,
                    related: changes,
                };
            },
        );

        await this.kept.keep(cover.isbn13, cover.file);
    }
}
