import type { CreateBackupUseCase } from '../ports/driving/create-backup-use-case.interface.js';
import type { ApplicationDataFiles } from '../ports/driven/application-data-files.interface.js';
import type { LibraryContentsReader } from '../ports/driven/library-contents-reader.interface.js';
import type { BackupArchive } from '../ports/driven/backup-archive.interface.js';
import type { Checksums } from '../ports/driven/checksums.interface.js';
import type { MaintenanceJournal } from '../ports/driven/maintenance-journal.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { BackupDescription } from '../backup-description.js';
import { MaintenanceAudit } from '../maintenance-audit.js';
import { BackupManifest } from '../../domain/value-objects/backup-manifest.value-object.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class CreateBackup implements CreateBackupUseCase {
    constructor(
        private readonly data: ApplicationDataFiles,
        private readonly library: LibraryContentsReader,
        private readonly archive: BackupArchive,
        private readonly checksums: Checksums,
        private readonly journal: MaintenanceJournal,
        private readonly clock: Clock,
        private readonly version: string,
    ) {}

    async execute(destination: string): Promise<BackupDescription> {
        if (!(await this.data.exists())) {
            throw new Failure(
                'not_found',
                'There is no application data to back up yet.',
                'backup-nothing',
            );
        }

        let description: BackupDescription;

        try {
            const contents = await this.library.read();
            const files = await this.data.read();
            const manifest = BackupManifest.create(
                this.version,
                this.clock.now().toISOString(),
                contents,
                Object.fromEntries(files.map((file) => [file.path, this.checksums.of(file.bytes)])),
            );

            await this.archive.write(destination, manifest.snapshot, files);
            description = {
                version: manifest.version,
                createdAt: manifest.createdAt,
                contents: manifest.contents,
            };
        } catch (error) {
            await this.recordFailure(error);

            throw error;
        }

        await this.journal.record({
            category: MaintenanceAudit.backupCreated,
            outcome: 'successful',
            details: { ...description, contents: { ...description.contents } },
            error: null,
        });

        return description;
    }

    private async recordFailure(error: unknown): Promise<void> {
        try {
            await this.journal.record({
                category: MaintenanceAudit.backupCreated,
                outcome: 'failed',
                details: null,
                error,
            });
        } catch {
            // Justified: an unavailable audit store must not replace the backup error.
        }
    }
}
