import type { SaveAppearanceUseCase } from '../ports/driving/save-appearance-use-case.interface.js';
import type { AppearanceStore } from '../ports/driven/appearance-store.interface.js';
import type { ColorSchemeName } from '../../domain/value-objects/color-scheme.value-object.js';
import { ColorScheme } from '../../domain/value-objects/color-scheme.value-object.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class SaveAppearance implements SaveAppearanceUseCase {
    constructor(
        private readonly store: AppearanceStore,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, colorScheme: string): Promise<{ colorScheme: ColorSchemeName }> {
        return this.operations.run(
            {
                category: 'appearance.color-scheme-changed',
                actorId: actor.id,
                subjectType: 'appearance',
                subjectId: 'color-scheme',
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const scheme = new ColorScheme(colorScheme);
                const before = (await this.store.read()).name;

                await this.store.save(scheme);

                return {
                    result: { colorScheme: scheme.name },
                    before: { colorScheme: before },
                    after: { colorScheme: scheme.name },
                };
            },
        );
    }
}
