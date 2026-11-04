import type { ColorSchemeName } from '../../../domain/value-objects/color-scheme.value-object.js';
import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface SaveAppearanceUseCase {
    // Administrator only; applies to every account and device.
    execute(actor: Actor, colorScheme: string): Promise<{ colorScheme: ColorSchemeName }>;
}
