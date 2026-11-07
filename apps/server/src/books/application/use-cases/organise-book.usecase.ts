import type { OrganiseBookUseCase } from '../ports/driving/organise-book-use-case.interface.js';
import { BookAudit, BookSnapshot } from '../book-audit.js';
import type { OrganisationRequest } from '../book-input.js';
import type { BookView } from '../book-views.js';
import { BookLoader } from '../services/book-loader.service.js';
import { BookOrganiser } from '../services/book-organiser.service.js';
import { BookViewer } from '../services/book-viewer.service.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// Saves the location and tags edited directly on the book details, one change at a time. The
// book information itself is left untouched.
export class OrganiseBook implements OrganiseBookUseCase {
    constructor(
        private readonly loader: BookLoader,
        private readonly organiser: BookOrganiser,
        private readonly viewer: BookViewer,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, bookId: string, request: OrganisationRequest): Promise<BookView> {
        return this.operations.run(
            {
                category: BookAudit.organised,
                actorId: actor.id,
                subjectType: BookAudit.book,
                subjectId: bookId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const book = await this.loader.load(bookId);
                const title = book.snapshot.details.title;
                const before = {
                    title,
                    ...BookSnapshot.organisation(await this.organiser.current(bookId)),
                };
                const { organisation, changes } = await this.organiser.apply(bookId, request);

                return {
                    result: await this.viewer.view(book, actor),
                    before,
                    after: { title, ...BookSnapshot.organisation(organisation) },
                    related: changes,
                };
            },
        );
    }
}
