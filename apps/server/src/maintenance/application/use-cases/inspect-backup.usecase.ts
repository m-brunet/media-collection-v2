import type { InspectBackupUseCase } from '../ports/driving/inspect-backup-use-case.interface.js';
import type { BackupDescription } from '../backup-description.js';
import type { BackupReader } from '../services/backup-reader.service.js';

export class InspectBackup implements InspectBackupUseCase {
    constructor(private readonly backups: BackupReader) {}

    async execute(source: string): Promise<BackupDescription> {
        return (await this.backups.read(source)).description;
    }
}
