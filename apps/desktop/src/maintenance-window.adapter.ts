import type { IpcMainInvokeEvent } from 'electron';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BackendProcess, WorkerFailure } from './backend-process.adapter.js';
import { BackupFileName } from './backup-file-name.util.js';
import type { BackupSummary, WorkerRequest, WorkerResponse } from './protocol.js';

interface MaintenanceFailure {
    success: false;
    reason: string | null;
    message: string;
    details: Record<string, unknown> | null;
}

export type MaintenanceResult<T> = { success: true; value: T } | MaintenanceFailure;

interface MaintenanceWindowOptions {
    dataDirectory: string;
    workerPath: string;
    preloadPath: string;
    pagePath: string;
    hidden: boolean;
}

// The local maintenance window: Admin recovery, backup and restore, with no HTTP server. The page
// only triggers actions; file paths come from native dialogs, never from the page.
export class MaintenanceWindow {
    private static readonly channels = [
        'maintenance:status',
        'maintenance:recover',
        'maintenance:create-backup',
        'maintenance:choose-backup',
        'maintenance:restore-backup',
    ];
    private readonly worker: BackendProcess;
    private window: BrowserWindow | undefined;
    private chosenBackup: string | null = null;
    private busy = false;

    constructor(private readonly options: MaintenanceWindowOptions) {
        this.worker = new BackendProcess(options.workerPath);
    }

    // Resolves once the window is closed and its worker has stopped.
    async open(): Promise<void> {
        const window = new BrowserWindow({
            width: 640,
            height: 820,
            minWidth: 560,
            minHeight: 600,
            title: 'Media Collection · Local maintenance',
            backgroundColor: '#1d2022',
            show: !this.options.hidden,
            webPreferences: {
                backgroundThrottling: !this.options.hidden,
                preload: this.options.preloadPath,
                contextIsolation: true,
                sandbox: true,
                nodeIntegration: false,
            },
        });

        this.window = window;
        window.setMenuBarVisibility(false);
        window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        window.webContents.on('will-navigate', (event) => event.preventDefault());
        window.webContents.on('will-attach-webview', (event) => event.preventDefault());
        this.register();
        const closed = new Promise<void>((resolve) => window.once('closed', () => resolve()));

        await window.loadFile(this.options.pagePath);
        await closed;
        this.unregister();
        // The worker may already have stopped when the application quits with the window open.
        await this.worker.close().catch(() => undefined);
    }

    private register(): void {
        this.handle('maintenance:status', () =>
            this.ask({ type: 'maintenance-status', ...this.target() }, (response) =>
                response.type === 'maintenance-status'
                    ? { administrator: response.administrator, hasData: response.hasData }
                    : null,
            ),
        );
        this.handle('maintenance:recover', (password) =>
            typeof password === 'string'
                ? this.ask({ type: 'recover', ...this.target(), password }, (response) =>
                      response.type === 'recovered' ? { username: response.username } : null,
                  )
                : Promise.resolve(this.invalid()),
        );
        this.handle('maintenance:create-backup', () => this.createBackup());
        this.handle('maintenance:choose-backup', () => this.chooseBackup());
        this.handle('maintenance:restore-backup', () => this.restoreBackup());
    }

    private unregister(): void {
        for (const channel of MaintenanceWindow.channels) {
            ipcMain.removeHandler(channel);
        }
    }

    private handle(channel: string, work: (input: unknown) => Promise<MaintenanceResult<unknown>>) {
        ipcMain.handle(channel, async (event: IpcMainInvokeEvent, input: unknown) => {
            if (!this.fromPage(event) || this.busy) {
                return this.invalid();
            }

            this.busy = true;

            try {
                return await work(input);
            } finally {
                this.busy = false;
            }
        });
    }

    private fromPage(event: IpcMainInvokeEvent): boolean {
        return (
            event.sender === this.window?.webContents &&
            event.senderFrame === this.window.webContents.mainFrame
        );
    }

    private async createBackup(): Promise<
        MaintenanceResult<{ backup: BackupSummary; file: string }>
    > {
        const folder = join(app.getPath('documents'), 'Media Collection backups');

        mkdirSync(folder, { recursive: true });
        const choice = await dialog.showSaveDialog(this.window!, {
            title: 'Create a backup',
            defaultPath: join(folder, BackupFileName.at(new Date())),
            filters: [{ name: 'Media Collection backup', extensions: [BackupFileName.extension] }],
        });

        if (choice.canceled || !choice.filePath) {
            return this.cancelled();
        }

        const destination = choice.filePath;

        return this.ask({ type: 'backup', ...this.target(), destination }, (response) =>
            response.type === 'backed-up' ? { backup: response.backup, file: destination } : null,
        );
    }

    private async chooseBackup(): Promise<
        MaintenanceResult<{ backup: BackupSummary; file: string }>
    > {
        this.chosenBackup = null;
        const choice = await dialog.showOpenDialog(this.window!, {
            title: 'Restore a backup',
            defaultPath: join(app.getPath('documents'), 'Media Collection backups'),
            properties: ['openFile'],
            filters: [{ name: 'Media Collection backup', extensions: [BackupFileName.extension] }],
        });
        const source = choice.filePaths[0];

        if (choice.canceled || !source) {
            return this.cancelled();
        }

        const result = await this.ask(
            { type: 'inspect-backup', ...this.target(), source },
            (response) =>
                response.type === 'backup-inspected'
                    ? { backup: response.backup, file: source }
                    : null,
        );

        if (result.success) {
            this.chosenBackup = source;
        }

        return result;
    }

    private async restoreBackup(): Promise<MaintenanceResult<{ backup: BackupSummary }>> {
        const source = this.chosenBackup;

        if (!source) {
            return this.invalid();
        }

        this.chosenBackup = null;

        return this.ask({ type: 'restore-backup', ...this.target(), source }, (response) =>
            response.type === 'restored' ? { backup: response.backup } : null,
        );
    }

    private target(): { dataDirectory: string; version: string } {
        return { dataDirectory: this.options.dataDirectory, version: app.getVersion() };
    }

    private async ask<T>(
        request: WorkerRequest,
        read: (response: WorkerResponse) => T | null,
    ): Promise<MaintenanceResult<T>> {
        try {
            const value = read(await this.worker.request(request, 600));

            if (value === null) {
                throw new Error('Unexpected maintenance response.');
            }

            return { success: true, value };
        } catch (error) {
            return {
                success: false,
                reason: error instanceof WorkerFailure ? error.reason : null,
                message: error instanceof Error ? error.message : 'Maintenance failed.',
                details: error instanceof WorkerFailure ? error.details : null,
            };
        }
    }

    private cancelled(): MaintenanceFailure {
        return { success: false, reason: 'cancelled', message: '', details: null };
    }

    private invalid(): MaintenanceFailure {
        return {
            success: false,
            reason: 'invalid-request',
            message: 'Invalid request.',
            details: null,
        };
    }
}
