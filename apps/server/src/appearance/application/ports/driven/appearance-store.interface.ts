import type { ColorScheme } from '../../../domain/value-objects/color-scheme.value-object.js';

export interface AppearanceStore {
    read(): Promise<ColorScheme>;
    save(scheme: ColorScheme): Promise<void>;
}
