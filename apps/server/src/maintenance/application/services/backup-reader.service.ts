import type { BackupArchive } from '../ports/driven/backup-archive.interface.js';
import type { Checksums } from '../ports/driven/checksums.interface.js';
import type { DataFile } from '../data-file.js';
import type { BackupDescription } from '../backup-description.js';
import { BackupManifest } from '../../domain/value-objects/backup-manifest.value-object.js';

export interface ReadBackup {
    description: BackupDescription;
    files: DataFile[];
}

// Reads a backup that this version can restore, with every file as it was saved.
export class BackupReader {
    constructor(
        private readonly archive: BackupArchive,
        private readonly checksums: Checksums,
        private readonly version: string,
    ) {}

    async read(source: string): Promise<ReadBackup> {
        const saved = await this.archive.read(source);
        const manifest = BackupManifest.parse(saved.manifest);

        manifest.ensureRestorableBy(this.version);
        manifest.ensureMatches(
            Object.fromEntries(
                saved.files.map((file) => [file.path, this.checksums.of(file.bytes)]),
            ),
        );

        return {
            description: {
                version: manifest.version,
                createdAt: manifest.createdAt,
                contents: manifest.contents,
            },
            files: saved.files,
        };
    }
}
