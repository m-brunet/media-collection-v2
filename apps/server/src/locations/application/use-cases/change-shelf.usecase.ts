import type { ChangeShelfUseCase } from '../ports/driving/change-shelf-use-case.interface.js';
import { LocationAudit, LocationSnapshot } from '../location-audit.js';
import type { ShelfChanges, ShelfView } from '../location-views.js';
import type { ShelfRepository } from '../ports/driven/shelf-repository.interface.js';
import { LocationLoader } from '../services/location-loader.service.js';
import { LocationNaming } from '../services/location-naming.service.js';
import { LocationOverview } from '../services/location-overview.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class ChangeShelf implements ChangeShelfUseCase {
    constructor(
        private readonly shelves: ShelfRepository,
        private readonly loader: LocationLoader,
        private readonly naming: LocationNaming,
        private readonly overview: LocationOverview,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, shelfId: string, changes: ShelfChanges): Promise<ShelfView> {
        return this.operations.run(
            {
                category: LocationAudit.shelfRenamed,
                actorId: actor.id,
                subjectType: LocationAudit.shelf,
                subjectId: shelfId,
            },
            async (context) => {
                ActorAuthorization.requireLibraryEditor(actor);
                const shelf = await this.loader.shelf(shelfId);

                if (
                    changes.bookcaseId !== undefined &&
                    changes.bookcaseId !== shelf.snapshot.bookcaseId
                ) {
                    context.category = LocationAudit.shelfMoved;
                }

                const before = LocationSnapshot.shelf(
                    shelf,
                    await this.loader.bookcase(shelf.snapshot.bookcaseId),
                );
                const destination = await this.loader.bookcase(
                    changes.bookcaseId ?? shelf.snapshot.bookcaseId,
                );
                const now = this.clock.now().toISOString();

                await this.naming.ensureShelfAvailable(
                    destination.id,
                    changes.name ?? shelf.snapshot.name,
                    shelfId,
                );

                if (changes.name !== undefined) {
                    shelf.rename(changes.name, now);
                }

                if (destination.id !== shelf.snapshot.bookcaseId) {
                    shelf.moveTo(destination.id, now);
                }

                await this.shelves.save(shelf);

                return {
                    result: await this.overview.shelf(shelf),
                    before,
                    after: LocationSnapshot.shelf(shelf, destination),
                };
            },
        );
    }
}
