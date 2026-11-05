import type { DeleteBookcaseUseCase } from '../ports/driving/delete-bookcase-use-case.interface.js';
import { LocationAudit, LocationSnapshot } from '../location-audit.js';
import type { BookcaseRepository } from '../ports/driven/bookcase-repository.interface.js';
import { LocationLoader } from '../services/location-loader.service.js';
import { LocationOverview } from '../services/location-overview.service.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// Removes the bookcase with its shelves; their books become unassigned and are kept.
export class DeleteBookcase implements DeleteBookcaseUseCase {
    constructor(
        private readonly bookcases: BookcaseRepository,
        private readonly loader: LocationLoader,
        private readonly overview: LocationOverview,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, bookcaseId: string): Promise<void> {
        await this.operations.run(
            {
                category: LocationAudit.bookcaseDeleted,
                actorId: actor.id,
                subjectType: LocationAudit.bookcase,
                subjectId: bookcaseId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const bookcase = await this.loader.bookcase(bookcaseId);
                const view = await this.overview.bookcase(bookcase);

                await this.bookcases.delete(bookcaseId);

                return {
                    result: undefined,
                    before: {
                        ...LocationSnapshot.bookcase(bookcase),
                        shelves: view.shelves.map((shelf) => shelf.name),
                        unassignedBooks: view.bookCount,
                    },
                    after: null,
                };
            },
        );
    }
}
