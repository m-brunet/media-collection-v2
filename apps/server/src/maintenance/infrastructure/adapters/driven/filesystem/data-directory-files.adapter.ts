import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ApplicationDataFiles } from '../../../../application/ports/driven/application-data-files.interface.js';
import type { DataFile } from '../../../../application/data-file.js';
import { BackupManifest } from '../../../../domain/value-objects/backup-manifest.value-object.js';
import type { RestoredDataCheck } from '../persistence/restored-data-check.adapter.js';
import { FileMoves } from './file-moves.adapter.js';

// The backed-up part of the data directory: `application.sqlite`, `covers/` and `tls/`. The
// session key and the Electron profile belong to this computer and stay out. The database must
// be closed while its file is read or replaced.
export class DataDirectoryFiles implements ApplicationDataFiles {
    private static readonly replaced = [
        'application.sqlite',
        'application.sqlite-wal',
        'application.sqlite-shm',
        'covers',
        'tls',
    ];

    constructor(
        private readonly directory: string,
        private readonly check: RestoredDataCheck,
        private readonly moves = new FileMoves(),
    ) {}

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

    async replace(files: readonly DataFile[]): Promise<void> {
        await mkdir(this.directory, { recursive: true });
        const staging = join(this.directory, '.restore-' + randomUUID());
        const previous = join(this.directory, '.previous-' + randomUUID());

        try {
            await this.stage(staging, files);
            await this.check.check(staging);
            await this.swap(staging, previous);
        } finally {
            await rm(staging, { recursive: true, force: true });
        }

        await rm(previous, { recursive: true, force: true });
    }

    private async stage(staging: string, files: readonly DataFile[]): Promise<void> {
        for (const file of files) {
            const target = join(staging, ...file.path.split('/'));

            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, file.bytes);
        }
    }

    private async swap(staging: string, previous: string): Promise<void> {
        await mkdir(previous);
        const moved: string[] = [];

        try {
            for (const name of DataDirectoryFiles.replaced) {
                if (existsSync(join(this.directory, name))) {
                    await this.moves.move(join(this.directory, name), join(previous, name));
                    moved.push(name);
                }
            }

            for (const name of DataDirectoryFiles.replaced) {
                if (existsSync(join(staging, name))) {
                    await this.moves.move(join(staging, name), join(this.directory, name));
                }
            }
        } catch (error) {
            for (const name of DataDirectoryFiles.replaced) {
                await rm(join(this.directory, name), { recursive: true, force: true });
            }

            for (const name of moved) {
                await this.moves.move(join(previous, name), join(this.directory, name));
            }

            await rm(previous, { recursive: true, force: true });

            throw error;
        }
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
