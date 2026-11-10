import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// One folder for manual and update backups, in the system Documents folder. Update backups are
// never deleted automatically.
export class BackupFolder {
    static readonly folderName = 'Media Collection backups';
    readonly path: string;

    constructor(documents: string) {
        this.path = join(documents, BackupFolder.folderName);
    }

    // Creates the folder when it is missing and returns its path.
    ensure(): string {
        mkdirSync(this.path, { recursive: true });

        return this.path;
    }
}
