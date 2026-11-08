import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Zippable } from 'fflate';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { BackupArchive } from '../../../../application/ports/driven/backup-archive.interface.js';
import type { DataFile } from '../../../../application/data-file.js';
import type { BackupManifestState } from '../../../../domain/value-objects/backup-manifest.value-object.js';
import { BackupManifest } from '../../../../domain/value-objects/backup-manifest.value-object.js';
import type { PrivateStorage } from '../../../../../shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';

// A `.mcbackup` file: a ZIP archive with `manifest.json` and the data files at their data
// directory paths. Covers are already compressed images, so only the database is compressed.
export class ZipBackupArchive implements BackupArchive {
    constructor(private readonly storage: PrivateStorage) {}

    async write(
        destination: string,
        manifest: BackupManifestState,
        files: readonly DataFile[],
    ): Promise<void> {
        const entries: Zippable = {
            [BackupManifest.path]: strToU8(JSON.stringify(manifest, null, 2)),
        };

        for (const file of files) {
            entries[file.path] = [
                file.bytes,
                { level: file.path === BackupManifest.databasePath ? 6 : 0 },
            ];
        }

        const partial = destination + '.partial';

        await mkdir(dirname(destination), { recursive: true });

        try {
            await writeFile(partial, zipSync(entries), { mode: 0o600 });
            this.storage.restrict(partial);
            await rename(partial, destination);
        } catch (error) {
            await rm(partial, { force: true });

            throw error;
        }
    }

    async read(source: string): Promise<{ manifest: unknown; files: DataFile[] }> {
        const entries = this.entries(await readFile(source));
        const manifest = entries[BackupManifest.path];

        if (!manifest) {
            throw this.invalid();
        }

        return {
            manifest: this.json(manifest),
            files: Object.entries(entries)
                .filter(([path]) => path !== BackupManifest.path && !path.endsWith('/'))
                .map(([path, bytes]) => ({ path, bytes })),
        };
    }

    private entries(bytes: Uint8Array): Record<string, Uint8Array> {
        try {
            return unzipSync(bytes);
        } catch {
            throw this.invalid();
        }
    }

    private json(bytes: Uint8Array): unknown {
        try {
            return JSON.parse(strFromU8(bytes));
        } catch {
            throw this.invalid();
        }
    }

    private invalid(): Failure {
        return new Failure(
            'invalid_input',
            'This file is not a Media Collection backup.',
            'backup-invalid',
        );
    }
}
