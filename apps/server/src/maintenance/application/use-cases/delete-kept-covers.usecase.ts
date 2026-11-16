import type { DeleteKeptCoversUseCase } from '../ports/driving/delete-kept-covers-use-case.interface.js';
import type { CoverFileCleanup } from '../ports/driven/cover-file-cleanup.interface.js';
import type { KeptCoverArchive } from '../ports/driven/kept-cover-archive.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { MaintenanceAudit } from '../maintenance-audit.js';

export class DeleteKeptCovers implements DeleteKeptCoversUseCase {
    constructor(
        private readonly archive: KeptCoverArchive,
        private readonly covers: CoverFileCleanup,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor): Promise<number> {
        const deleted = await this.operations.run(
            {
                category: MaintenanceAudit.keptCoversDeleted,
                actorId: actor.id,
                subjectType: 'installation',
                subjectId: null,
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const count = await this.archive.deleteAll();

                return {
                    result: count,
                    before: { keptCovers: count },
                    after: { keptCovers: 0 },
                };
            },
        );

        await this.covers.removeUnreferenced();

        return deleted;
    }
}
