import type { IconSet } from '../../../domain/value-objects/icon-set.value-object.js';

export interface IconSetReader {
    read(): Promise<IconSet>;
}
