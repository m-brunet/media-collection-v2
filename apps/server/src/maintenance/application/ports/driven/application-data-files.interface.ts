import type { DataFile } from '../../data-file.js';

// The application data a backup holds: the database, the covers and the HTTPS certificate.
export interface ApplicationDataFiles {
    exists(): Promise<boolean>;
    read(): Promise<DataFile[]>;
    // Replaces the data with the given files, or leaves it unchanged and throws a
    // `backup-damaged` failure when they do not form usable application data.
    replace(files: readonly DataFile[]): Promise<void>;
}
