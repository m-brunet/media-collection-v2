import type { DeleteShelfUseCase } from '../ports/driving/delete-shelf-use-case.interface.js';
import { LocationAudit, LocationSnapshot } from '../location-audit.js';
import type { ShelfRepository } from '../ports/driven/shelf-repository.interface.js';
import { LocationLoader } from '../services/location-loader.service.js';
import { LocationOverview } from '../services/location-overview.service.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// Removes the shelf definition; its books become unassigned and are kept.
export class DeleteShelf implements DeleteShelfUseCase {
    constructor(
        private readonly shelves: ShelfRepository,
        private readonly loader: LocationLoader,
        private readonly overview: LocationOverview,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, shelfId: string): Promise<void> {
        await this.operations.run(
            {
                category: LocationAudit.shelfDeleted,
                actorId: actor.id,
                subjectType: LocationAudit.shelf,
                subjectId: shelfId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const shelf = await this.loader.shelf(shelfId);
                const bookcase = await this.loader.bookcase(shelf.snapshot.bookcaseId);
                const view = await this.overview.shelf(shelf);

                await this.shelves.delete(shelfId);

                return {
                    result: undefined,
                    before: {
                        ...LocationSnapshot.shelf(shelf, bookcase),
                        unassignedBooks: view.bookCount,
                    },
                    after: null,
                };
            },
        );
    }
}
