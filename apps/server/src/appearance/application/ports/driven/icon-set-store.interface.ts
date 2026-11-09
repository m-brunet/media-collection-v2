import type { IconSet } from '../../../domain/value-objects/icon-set.value-object.js';
import type { IconSetReader } from './icon-set-reader.interface.js';

export interface IconSetStore extends IconSetReader {
    save(set: IconSet): Promise<void>;
}
