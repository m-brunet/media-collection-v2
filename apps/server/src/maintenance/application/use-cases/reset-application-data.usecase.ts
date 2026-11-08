import type { ResetApplicationDataUseCase } from '../ports/driving/reset-application-data-use-case.interface.js';
import type { AdministratorPasswordCheck } from '../ports/driven/administrator-password-check.interface.js';
import type { ApplicationDataEraser } from '../ports/driven/application-data-eraser.interface.js';
import type { CoverFileCleanup } from '../ports/driven/cover-file-cleanup.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { MaintenanceAudit } from '../maintenance-audit.js';

// The audit record of the reset is written after the erase, so it is the only one left.
export class ResetApplicationData implements ResetApplicationDataUseCase {
    constructor(
        private readonly passwords: AdministratorPasswordCheck,
        private readonly eraser: ApplicationDataEraser,
        private readonly covers: CoverFileCleanup,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, password: string): Promise<void> {
        await this.operations.run(
            {
                category: MaintenanceAudit.dataReset,
                actorId: actor.id,
                subjectType: 'installation',
                subjectId: null,
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                await this.passwords.confirm(actor.id, password);
                await this.eraser.erase(actor.id);

                return { result: undefined, before: null, after: null };
            },
        );
        await this.covers.removeUnreferenced();
    }
}
