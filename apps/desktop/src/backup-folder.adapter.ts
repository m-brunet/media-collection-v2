import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export class BackupFolder {
    static readonly folderName = 'Media Collection backups';
    readonly path: string;

    constructor(documents: string) {
        this.path = join(documents, BackupFolder.folderName);
    }

    ensure(): string {
        mkdirSync(this.path, { recursive: true });

        return this.path;
    }
}
