import type { BackupContents } from '../../../domain/value-objects/backup-manifest.value-object.js';

export interface LibraryContentsReader {
    read(): Promise<BackupContents>;
}
