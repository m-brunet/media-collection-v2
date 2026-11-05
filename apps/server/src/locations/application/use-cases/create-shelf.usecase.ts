import type { CreateShelfUseCase } from '../ports/driving/create-shelf-use-case.interface.js';
import { LocationAudit, LocationSnapshot } from '../location-audit.js';
import type { ShelfView } from '../location-views.js';
import type { ShelfRepository } from '../ports/driven/shelf-repository.interface.js';
import { LocationLoader } from '../services/location-loader.service.js';
import { LocationNaming } from '../services/location-naming.service.js';
import { LocationOverview } from '../services/location-overview.service.js';
import { Shelf } from '../../domain/entities/shelf.entity.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// A new empty shelf inside an existing bookcase.
export class CreateShelf implements CreateShelfUseCase {
    constructor(
        private readonly shelves: ShelfRepository,
        private readonly loader: LocationLoader,
        private readonly naming: LocationNaming,
        private readonly overview: LocationOverview,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, bookcaseId: string, name: string): Promise<ShelfView> {
        return this.operations.run(
            {
                category: LocationAudit.shelfCreated,
                actorId: actor.id,
                subjectType: LocationAudit.shelf,
                subjectId: null,
            },
            async (context) => {
                ActorAuthorization.requireLibraryEditor(actor);
                const bookcase = await this.loader.bookcase(bookcaseId);

                await this.naming.ensureShelfAvailable(bookcaseId, name, null);
                const now = this.clock.now().toISOString();
                const shelf = new Shelf({
                    id: this.ids.next(),
                    bookcaseId,
                    name,
                    createdAt: now,
                    updatedAt: now,
                });

                context.subjectId = shelf.id;
                await this.shelves.create(shelf);

                return {
                    result: await this.overview.shelf(shelf),
                    before: null,
                    after: LocationSnapshot.shelf(shelf, bookcase),
                };
            },
        );
    }
}
