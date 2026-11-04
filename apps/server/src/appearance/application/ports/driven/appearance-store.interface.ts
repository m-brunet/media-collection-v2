import type { ColorScheme } from '../../../domain/value-objects/color-scheme.value-object.js';

// The installation's saved appearance; reads return the default when nothing was saved yet.
export interface AppearanceStore {
    read(): Promise<ColorScheme>;
    save(scheme: ColorScheme): Promise<void>;
}
