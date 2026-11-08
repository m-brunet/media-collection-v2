import type { BackupContents } from '../domain/value-objects/backup-manifest.value-object.js';

export interface BackupDescription {
    version: string;
    createdAt: string;
    contents: BackupContents;
}
