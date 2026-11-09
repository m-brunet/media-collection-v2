import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { IconSetName } from '../../domain/value-objects/icon-set.value-object.js';
import { IconSet } from '../../domain/value-objects/icon-set.value-object.js';
import type { IconSetStore } from '../ports/driven/icon-set-store.interface.js';
import type { SaveIconSetUseCase } from '../ports/driving/save-icon-set-use-case.interface.js';

// Changes the icon set of the whole installation.
export class SaveIconSet implements SaveIconSetUseCase {
    constructor(
        private readonly store: IconSetStore,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, iconSet: string): Promise<{ iconSet: IconSetName }> {
        return this.operations.run(
            {
                category: 'appearance.icon-set-changed',
                actorId: actor.id,
                subjectType: 'appearance',
                subjectId: 'icon-set',
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const set = new IconSet(iconSet);
                const before = (await this.store.read()).name;

                await this.store.save(set);

                return {
                    result: { iconSet: set.name },
                    before: { iconSet: before },
                    after: { iconSet: set.name },
                };
            },
        );
    }
}
