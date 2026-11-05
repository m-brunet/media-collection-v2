import type { RenameBookcaseUseCase } from '../ports/driving/rename-bookcase-use-case.interface.js';
import { LocationAudit, LocationSnapshot } from '../location-audit.js';
import type { BookcaseView } from '../location-views.js';
import type { BookcaseRepository } from '../ports/driven/bookcase-repository.interface.js';
import { LocationLoader } from '../services/location-loader.service.js';
import { LocationNaming } from '../services/location-naming.service.js';
import { LocationOverview } from '../services/location-overview.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// Every book on its shelves shows the new name; an equivalent existing name blocks the rename.
export class RenameBookcase implements RenameBookcaseUseCase {
    constructor(
        private readonly bookcases: BookcaseRepository,
        private readonly loader: LocationLoader,
        private readonly naming: LocationNaming,
        private readonly overview: LocationOverview,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, bookcaseId: string, name: string): Promise<BookcaseView> {
        return this.operations.run(
            {
                category: LocationAudit.bookcaseRenamed,
                actorId: actor.id,
                subjectType: LocationAudit.bookcase,
                subjectId: bookcaseId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const bookcase = await this.loader.bookcase(bookcaseId);
                const before = LocationSnapshot.bookcase(bookcase);

                await this.naming.ensureBookcaseAvailable(name, bookcaseId);
                bookcase.rename(name, this.clock.now().toISOString());
                await this.bookcases.save(bookcase);

                return {
                    result: await this.overview.bookcase(bookcase),
                    before,
                    after: LocationSnapshot.bookcase(bookcase),
                };
            },
        );
    }
}
