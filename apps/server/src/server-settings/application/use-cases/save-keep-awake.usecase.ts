import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { KeepAwakeRuntime } from '../ports/driven/keep-awake-runtime.interface.js';
import type { KeepAwakeStore } from '../ports/driven/keep-awake-store.interface.js';
import type { SaveKeepAwakeUseCase } from '../ports/driving/save-keep-awake-use-case.interface.js';
import { SettingsAudit } from '../settings-audit.js';

export class SaveKeepAwake implements SaveKeepAwakeUseCase {
    constructor(
        private readonly store: KeepAwakeStore,
        private readonly runtime: KeepAwakeRuntime,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, input: { enabled: boolean }): Promise<boolean> {
        const enabled = await this.operations.run(
            {
                category: SettingsAudit.keepAwake,
                actorId: actor.id,
                subjectType: SettingsAudit.subject,
                subjectId: 'keep-awake',
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const before = await this.store.read();

                await this.store.save(input.enabled);

                return {
                    result: input.enabled,
                    before: { enabled: before },
                    after: { enabled: input.enabled },
                };
            },
        );

        this.runtime.apply(enabled);

        return enabled;
    }
}
