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

export class UpdateBackup {
    constructor(private readonly options: UpdateBackupOptions) {}

    async make(update: AvailableUpdate): Promise<void> {
        const destination = join(
            this.options.folder.ensure(),
            BackupFileName.at(new Date(), update.version),
        );
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
            if (!(error instanceof WorkerFailure && error.reason === 'backup-nothing')) {
                throw error;
            }
        } finally {
            await worker.close().catch(() => undefined);
        }
    }
}
