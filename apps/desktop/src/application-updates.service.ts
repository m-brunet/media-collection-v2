export interface AvailableUpdate {
    version: string;
    // The release page, opened for a manual installation.
    releasePage: string;
}

export interface UpdateSource {
    // Windows downloads and installs the update; Linux installs it by hand from the release page.
    readonly integratedInstall: boolean;
    // `null` when this is the latest stable version.
    check(): Promise<AvailableUpdate | null>;
    download(): Promise<void>;
    // Quits and installs the downloaded update.
    install(): void;
}

// Each dialog resolves `true` for its main action (Download, Retry, Restart and install...).
export interface UpdateDialogs {
    upToDate(): Promise<void>;
    available(update: AvailableUpdate, integratedInstall: boolean): Promise<boolean>;
    checkFailed(message: string): Promise<boolean>;
    downloadFailed(update: AvailableUpdate, message: string): Promise<boolean>;
    ready(update: AvailableUpdate): Promise<boolean>;
    backupFailed(message: string): Promise<boolean>;
}

export interface UpdateHost {
    stopServer(): Promise<void>;
    // The full backup before an update, made while the server is stopped.
    backup(update: AvailableUpdate): Promise<void>;
    startServer(): Promise<void>;
    openPage(address: string): Promise<void>;
}

export type UpdateState =
    | { kind: 'idle' }
    | { kind: 'checking' }
    | { kind: 'downloading'; update: AvailableUpdate }
    | { kind: 'ready'; update: AvailableUpdate };

// The update flow from the File menu: check, download (Windows) or backup and download page (Linux),
// and Restart and install. Nothing is downloaded or installed without the user's choice.
export class ApplicationUpdates {
    private state: UpdateState = { kind: 'idle' };
    private offered = false;
    private busy = false;

    constructor(
        private readonly source: UpdateSource,
        private readonly dialogs: UpdateDialogs,
        private readonly host: UpdateHost,
        private readonly changed: (state: UpdateState) => void,
    ) {}

    current(): UpdateState {
        return this.state;
    }

    // Silent when up to date or when the check fails; offers an update at most once per start.
    async checkAtStartup(): Promise<void> {
        await this.exclusive(async () => {
            const update = await this.check().catch(() => null);

            if (update && !this.offered) {
                await this.offer(update);
            }
        });
    }

    // The menu item: a manual check, or the postponed installation once the update is ready.
    async chooseFromMenu(): Promise<void> {
        await this.exclusive(async () => {
            if (this.state.kind === 'ready') {
                await this.confirmInstall(this.state.update);
            } else if (this.state.kind === 'idle') {
                await this.checkManually();
            }
        });
    }

    private async checkManually(): Promise<void> {
        for (;;) {
            try {
                const update = await this.check();

                if (update) {
                    await this.offer(update);
                } else {
                    await this.dialogs.upToDate();
                }

                return;
            } catch (error) {
                if (!(await this.dialogs.checkFailed(this.message(error)))) {
                    return;
                }
            }
        }
    }

    private async check(): Promise<AvailableUpdate | null> {
        this.move({ kind: 'checking' });

        try {
            return await this.source.check();
        } finally {
            this.move({ kind: 'idle' });
        }
    }

    private async offer(update: AvailableUpdate): Promise<void> {
        this.offered = true;

        if (!(await this.dialogs.available(update, this.source.integratedInstall))) {
            return;
        }

        if (this.source.integratedInstall) {
            await this.download(update);
        } else if (await this.backUp(update, true)) {
            await this.host.openPage(update.releasePage);
        }
    }

    private async download(update: AvailableUpdate): Promise<void> {
        for (;;) {
            this.move({ kind: 'downloading', update });

            try {
                await this.source.download();
                this.move({ kind: 'ready', update });
                await this.confirmInstall(update);

                return;
            } catch (error) {
                this.move({ kind: 'idle' });

                if (!(await this.dialogs.downloadFailed(update, this.message(error)))) {
                    return;
                }
            }
        }
    }

    private async confirmInstall(update: AvailableUpdate): Promise<void> {
        if ((await this.dialogs.ready(update)) && (await this.backUp(update, false))) {
            this.source.install();
        }
    }

    // Stops the server and saves the full backup, with Retry on failure. The server starts again
    // when the backup is given up, and after it when `restart` (Linux: the application goes on).
    private async backUp(update: AvailableUpdate, restart: boolean): Promise<boolean> {
        await this.host.stopServer();

        for (;;) {
            try {
                await this.host.backup(update);
                break;
            } catch (error) {
                if (!(await this.dialogs.backupFailed(this.message(error)))) {
                    await this.host.startServer();

                    return false;
                }
            }
        }

        if (restart) {
            await this.host.startServer();
        }

        return true;
    }

    private async exclusive(work: () => Promise<void>): Promise<void> {
        if (this.busy) {
            return;
        }

        this.busy = true;

        try {
            await work();
        } finally {
            this.busy = false;
        }
    }

    private move(state: UpdateState): void {
        this.state = state;
        this.changed(state);
    }

    private message(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
