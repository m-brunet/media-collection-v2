import type { IconSet } from '../../../domain/value-objects/icon-set.value-object.js';

// The installation's saved icon set; Lucide when nothing was saved yet.
export interface IconSetReader {
    read(): Promise<IconSet>;
}
