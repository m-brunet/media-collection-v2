import type { DataFile } from '../../data-file.js';

export interface ApplicationDataFiles {
    exists(): Promise<boolean>;
    read(): Promise<DataFile[]>;
    replace(files: readonly DataFile[]): Promise<void>;
}
