import type { ChangeBookcaseUseCase } from '../ports/driving/change-bookcase-use-case.interface.js';
import { LocationAudit } from '../location-audit.js';
import { LocationSnapshot } from '../location-snapshot.helper.js';
import type { BookcaseChanges, BookcaseView } from '../location-views.js';
import type { BookcaseRepository } from '../ports/driven/bookcase-repository.interface.js';
import { LocationLoader } from '../services/location-loader.service.js';
import { LocationNaming } from '../services/location-naming.service.js';
import { LocationOverview } from '../services/location-overview.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class ChangeBookcase implements ChangeBookcaseUseCase {
    constructor(
        private readonly bookcases: BookcaseRepository,
        private readonly loader: LocationLoader,
        private readonly naming: LocationNaming,
        private readonly overview: LocationOverview,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(
        actor: Actor,
        bookcaseId: string,
        changes: BookcaseChanges,
    ): Promise<BookcaseView> {
        return this.operations.run(
            {
                category:
                    changes.name === undefined
                        ? LocationAudit.bookcaseResized
                        : LocationAudit.bookcaseRenamed,
                actorId: actor.id,
                subjectType: LocationAudit.bookcase,
                subjectId: bookcaseId,
            },
            async (context) => {
                ActorAuthorization.requireLibraryEditor(actor);
                const bookcase = await this.loader.bookcase(bookcaseId);
                const before = LocationSnapshot.bookcase(bookcase);
                const now = this.clock.now().toISOString();

                if (changes.name !== undefined) {
                    await this.naming.ensureBookcaseAvailable(changes.name, bookcaseId);
                    bookcase.rename(changes.name, now);
                }

                if (changes.size !== undefined) {
                    bookcase.resize(changes.size, now);
                }

                await this.bookcases.save(bookcase);
                const after = LocationSnapshot.bookcase(bookcase);

                context.category =
                    before.name === after.name
                        ? LocationAudit.bookcaseResized
                        : LocationAudit.bookcaseRenamed;

                return {
                    result: await this.overview.bookcase(bookcase),
                    before,
                    after,
                };
            },
        );
    }
}
