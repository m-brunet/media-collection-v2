import type { DataFile } from '../../data-file.js';
import type { BackupManifestState } from '../../../domain/value-objects/backup-manifest.value-object.js';

export interface BackupArchive {
    write(
        destination: string,
        manifest: BackupManifestState,
        files: readonly DataFile[],
    ): Promise<void>;
    read(source: string): Promise<{ manifest: unknown; files: DataFile[] }>;
}
