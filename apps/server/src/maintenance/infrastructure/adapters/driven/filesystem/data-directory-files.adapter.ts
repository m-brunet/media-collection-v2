import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ApplicationDataFiles } from '../../../../application/ports/driven/application-data-files.interface.js';
import type { DataFile } from '../../../../application/data-file.js';
import { BackupManifest } from '../../../../domain/value-objects/backup-manifest.value-object.js';

// The backed-up part of the data directory: `application.sqlite`, `covers/` and `tls/`. The
// session key and the Electron profile belong to this computer and stay out. The database must
// be closed while its file is read or replaced.
export class DataDirectoryFiles implements ApplicationDataFiles {
    constructor(private readonly directory: string) {}

    async exists(): Promise<boolean> {
        return existsSync(join(this.directory, BackupManifest.databasePath));
    }

    async read(): Promise<DataFile[]> {
        const paths = [
            BackupManifest.databasePath,
            ...(await this.list('covers')),
            ...(await this.list('tls', true)),
        ].filter((path) => BackupManifest.isEntryPath(path));
        const files: DataFile[] = [];

        for (const path of paths) {
            files.push({ path, bytes: await readFile(join(this.directory, ...path.split('/'))) });
        }

        return files;
    }

    async replace(): Promise<void> {
        throw new Error('Restoring is not available yet.');
    }

    private async list(folder: string, nested = false): Promise<string[]> {
        const entries = await readdir(join(this.directory, folder), {
            withFileTypes: true,
        }).catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') {
                return [];
            }

            throw error;
        });
        const paths: string[] = [];

        for (const entry of entries) {
            if (entry.isFile()) {
                paths.push(folder + '/' + entry.name);
            } else if (nested && entry.isDirectory()) {
                paths.push(...(await this.list(folder + '/' + entry.name)));
            }
        }

        return paths;
    }
}
