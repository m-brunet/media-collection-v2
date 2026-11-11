import type { ColorSchemeName } from '../../../domain/value-objects/color-scheme.value-object.js';
import type { IconSetName } from '../../../domain/value-objects/icon-set.value-object.js';

export interface ReadAppearanceUseCase {
    execute(): Promise<{ colorScheme: ColorSchemeName; iconSet: IconSetName }>;
}
