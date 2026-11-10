import { app } from 'electron';
import { join } from 'node:path';
import { BackendProcess, WorkerFailure } from './backend-process.adapter.js';
import { BackupFileName } from './backup-file-name.util.js';
import type { BackupFolder } from './backup-folder.adapter.js';
import type { AvailableUpdate } from './application-updates.service.js';

interface UpdateBackupOptions {
    workerPath: string;
    dataDirectory: string;
    folder: BackupFolder;
}

// The full backup before an update, in the backup folder, made by a maintenance worker while the
// server is stopped (the same backup as the Maintenance window's).
export class UpdateBackup {
    constructor(private readonly options: UpdateBackupOptions) {}

    async make(update: AvailableUpdate): Promise<void> {
        const destination = join(
            this.options.folder.ensure(),
            BackupFileName.at(new Date(), update.version),
        );
        // Started once the folder is ready, so a missing folder leaves no worker behind.
        const worker = new BackendProcess(this.options.workerPath);

        try {
            const response = await worker.request(
                {
                    type: 'backup',
                    dataDirectory: this.options.dataDirectory,
                    version: app.getVersion(),
                    destination,
                },
                600,
            );

            if (response.type !== 'backed-up') {
                throw new Error('Unexpected backup response.');
            }
        } catch (error) {
            // A new installation has no data yet: there is nothing to lose, so nothing to save.
            if (!(error instanceof WorkerFailure && error.reason === 'backup-nothing')) {
                throw error;
            }
        } finally {
            await worker.close().catch(() => undefined);
        }
    }
}
