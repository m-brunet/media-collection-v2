import type { ColorSchemeName } from '../../../domain/value-objects/color-scheme.value-object.js';
import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface SaveAppearanceUseCase {
    execute(actor: Actor, colorScheme: string): Promise<{ colorScheme: ColorSchemeName }>;
}
