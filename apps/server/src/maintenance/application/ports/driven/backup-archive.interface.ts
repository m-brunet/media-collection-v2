import type { DataFile } from '../../data-file.js';
import type { BackupManifestState } from '../../../domain/value-objects/backup-manifest.value-object.js';

export interface BackupArchive {
    write(
        destination: string,
        manifest: BackupManifestState,
        files: readonly DataFile[],
    ): Promise<void>;
    // The manifest is returned unchecked. Throws a `backup-invalid` failure for a file that is not
    // a backup archive.
    read(source: string): Promise<{ manifest: unknown; files: DataFile[] }>;
}
