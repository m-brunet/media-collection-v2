import type { RestoreBackupUseCase } from '../ports/driving/restore-backup-use-case.interface.js';
import type { ApplicationDataFiles } from '../ports/driven/application-data-files.interface.js';
import type { MaintenanceJournal } from '../ports/driven/maintenance-journal.interface.js';
import type { SessionKeyRotation } from '../ports/driven/session-key-rotation.interface.js';
import type { BackupDescription } from '../backup-description.js';
import type { BackupReader } from '../services/backup-reader.service.js';
import { MaintenanceAudit } from '../maintenance-audit.js';

export class RestoreBackup implements RestoreBackupUseCase {
    constructor(
        private readonly backups: BackupReader,
        private readonly data: ApplicationDataFiles,
        private readonly sessions: SessionKeyRotation,
        private readonly journal: MaintenanceJournal,
    ) {}

    async execute(source: string): Promise<BackupDescription> {
        let description: BackupDescription;

        try {
            const backup = await this.backups.read(source);

            await this.data.replace(backup.files);
            description = backup.description;
        } catch (error) {
            await this.recordFailure(error);

            throw error;
        }

        await this.sessions.rotate();
        await this.journal.record({
            category: MaintenanceAudit.backupRestored,
            outcome: 'successful',
            details: { ...description, contents: { ...description.contents } },
            error: null,
        });

        return description;
    }

    private async recordFailure(error: unknown): Promise<void> {
        try {
            if (await this.data.exists()) {
                await this.journal.record({
                    category: MaintenanceAudit.backupRestored,
                    outcome: 'failed',
                    details: null,
                    error,
                });
            }
        } catch {
            // Justified: an unavailable audit store must not replace the restore error.
        }
    }
}
