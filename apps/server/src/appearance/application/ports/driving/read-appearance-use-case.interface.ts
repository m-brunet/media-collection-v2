import type { ColorSchemeName } from '../../../domain/value-objects/color-scheme.value-object.js';

export interface ReadAppearanceUseCase {
    // Public: the interface needs the colours before anyone signs in.
    execute(): Promise<{ colorScheme: ColorSchemeName }>;
}
