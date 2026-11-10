import type { IconSet } from '../../../domain/value-objects/icon-set.value-object.js';

// Lucide when nothing was saved yet.
export interface IconSetReader {
    read(): Promise<IconSet>;
}
