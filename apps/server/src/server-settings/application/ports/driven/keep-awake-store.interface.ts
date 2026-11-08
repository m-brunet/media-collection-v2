import type { KeepAwakeReader } from './keep-awake-reader.interface.js';

export interface KeepAwakeStore extends KeepAwakeReader {
    save(enabled: boolean): Promise<void>;
}
