import type { CreateBookcaseUseCase } from '../ports/driving/create-bookcase-use-case.interface.js';
import { LocationAudit, LocationSnapshot } from '../location-audit.js';
import type { BookcaseView } from '../location-views.js';
import type { BookcaseRepository } from '../ports/driven/bookcase-repository.interface.js';
import { LocationNaming } from '../services/location-naming.service.js';
import { LocationOverview } from '../services/location-overview.service.js';
import { Bookcase } from '../../domain/entities/bookcase.entity.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// A new empty bookcase, ready for shelves.
export class CreateBookcase implements CreateBookcaseUseCase {
    constructor(
        private readonly bookcases: BookcaseRepository,
        private readonly naming: LocationNaming,
        private readonly overview: LocationOverview,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, name: string): Promise<BookcaseView> {
        return this.operations.run(
            {
                category: LocationAudit.bookcaseCreated,
                actorId: actor.id,
                subjectType: LocationAudit.bookcase,
                subjectId: null,
            },
            async (context) => {
                ActorAuthorization.requireLibraryEditor(actor);
                await this.naming.ensureBookcaseAvailable(name, null);
                const now = this.clock.now().toISOString();
                const bookcase = new Bookcase({
                    id: this.ids.next(),
                    name,
                    createdAt: now,
                    updatedAt: now,
                });

                context.subjectId = bookcase.id;
                await this.bookcases.create(bookcase);

                return {
                    result: await this.overview.bookcase(bookcase),
                    before: null,
                    after: LocationSnapshot.bookcase(bookcase),
                };
            },
        );
    }
}
