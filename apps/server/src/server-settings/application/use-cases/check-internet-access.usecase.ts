import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { InternetAccessState } from '../../domain/entities/internet-access.entity.js';
import type { BackgroundTasks } from '../ports/driven/background-tasks.interface.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { CheckInternetAccessUseCase } from '../ports/driving/check-internet-access-use-case.interface.js';
import type { InternetAccessSetup } from '../services/internet-access-setup.service.js';
import { SettingsAudit } from '../settings-audit.js';

export class CheckInternetAccess implements CheckInternetAccessUseCase {
    constructor(
        private readonly store: InternetAccessStore,
        private readonly setup: InternetAccessSetup,
        private readonly background: BackgroundTasks,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor): Promise<InternetAccessState> {
        const state = await this.operations.run(
            {
                category: SettingsAudit.internetAccessSetUp,
                actorId: actor.id,
                subjectType: SettingsAudit.subject,
                subjectId: 'internet-access',
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const access = await this.store.read();
                const before = access.snapshot;

                access.check();
                await this.store.save(access);

                return {
                    result: access.snapshot,
                    before: { ...before },
                    after: { ...access.snapshot },
                };
            },
        );

        this.background.run(() => this.setup.check());

        return state;
    }
}
