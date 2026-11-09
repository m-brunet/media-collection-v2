import type { ColorSchemeName } from '../../../domain/value-objects/color-scheme.value-object.js';
import type { IconSetName } from '../../../domain/value-objects/icon-set.value-object.js';

export interface ReadAppearanceUseCase {
    // Public: the interface needs the colours and icons before anyone signs in.
    execute(): Promise<{ colorScheme: ColorSchemeName; iconSet: IconSetName }>;
}
