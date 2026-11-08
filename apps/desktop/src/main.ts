import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import type { DevelopmentMaintenance } from './configuration.util.js';
import { DesktopConfigurationParser } from './configuration.util.js';
import { DevelopmentDataGuard } from './development-data-guard.util.js';
import { BackendProcess } from './backend-process.adapter.js';
import { SetupRequestSigner } from './setup-request-signer.adapter.js';

// Automated tests run the real windows without putting them on screen.
const hiddenWindows = process.env.APP_HIDDEN_WINDOWS === '1';
const directory = dirname(fileURLToPath(import.meta.url));

app.setName('Media Collection');
let backend: BackendProcess | undefined;
let quitting = false;
let shutdownComplete = false;
let window: BrowserWindow | undefined;
let restarting = false;
const setupSigner = new SetupRequestSigner();
// Development data commands run from a terminal: they report there instead of in dialogs.
const commandLine = process.argv.some(
    (arg) => arg === '--dev-reset-data' || arg === '--dev-import-v1',
);
const startupOptions = (() => {
    try {
        const defaultData = app.isPackaged
            ? app.getPath('userData')
            : join(app.getAppPath(), DevelopmentDataGuard.directoryName);
        const options = DesktopConfigurationParser.parse(
            process.argv.slice(1),
            process.env,
            defaultData,
        );

        if (options.recoveryLogin && !existsSync(options.dataDirectory)) {
            throw new Error('Recovery requires an existing data directory.');
        }

        // Before anything is created in the data directory.
        if (options.maintenance) {
            DevelopmentDataGuard.ensure({
                packaged: app.isPackaged,
                appPath: app.getAppPath(),
                dataDirectory: options.dataDirectory,
                dataDirectoryOverridden: options.dataDirectoryOverridden,
            });
        }

        const profile = join(options.dataDirectory, 'electron-profile');

        mkdirSync(profile, { recursive: true, mode: 0o700 });
        app.setPath('userData', profile);

        return options;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Configuration failed.';

        if (commandLine) {
            console.error(message);
        } else {
            dialog.showErrorBox('Invalid application configuration', message);
        }

        return undefined;
    }
})();

if (!startupOptions) {
    app.exit(1);
} else if (!app.requestSingleInstanceLock()) {
    // The lock follows the data directory's profile: only an instance using the same data blocks this one.
    console.error(
        'The application is already running with this data directory. Close it before using recovery or development data commands.',
    );
    app.exit(1);
} else if (startupOptions.maintenance) {
    const { dataDirectory, maintenance } = startupOptions;

    void app.whenReady().then(() => maintain(dataDirectory, maintenance));
} else {
    app.on('second-instance', () => {
        if (!hiddenWindows) {
            window?.show();
            window?.focus();
        }
    });
    app.on('window-all-closed', () => {
        if (!restarting) {
            app.quit();
        }
    });
    app.on('before-quit', (event) => {
        if (shutdownComplete) {
            return;
        }

        event.preventDefault();

        if (quitting) {
            return;
        }

        quitting = true;
        void (async () => {
            try {
                await backend?.close();
            } finally {
                shutdownComplete = true;
                app.quit();
            }
        })();
    });
    process.on('SIGTERM', () => app.quit());
    process.on('SIGINT', () => app.quit());
    void app.whenReady().then(async () => {
        try {
            const options = startupOptions;

            if (options.recoveryLogin) {
                await recovery(options.dataDirectory);
            } else {
                await launch(options);
            }
        } catch (error) {
            dialog.showErrorBox(
                'Application could not start',
                error instanceof Error ? error.message : 'Unknown startup error.',
            );
            app.quit();
        }
    });
}

async function launch(options: ReturnType<typeof DesktopConfigurationParser.parse>): Promise<void> {
    while (!quitting) {
        backend = new BackendProcess(join(directory, 'worker.js'));

        try {
            const ready = await backend.request({
                type: 'start',
                ...options,
                webDirectory: join(directory, '../../web'),
                development: !app.isPackaged,
                setupToken: setupSigner.secret,
            });

            if (ready.type !== 'ready') {
                throw new Error('Unexpected startup response.');
            }

            // Development tooling updates its API proxy before the renderer starts requesting data.
            console.log('Application backend ready on HTTP port ' + ready.httpPort);

            const host = ['0.0.0.0', '::'].includes(options.host)
                ? '127.0.0.1'
                : options.host.includes(':')
                  ? '[' + options.host + ']'
                  : options.host;
            const url =
                (!app.isPackaged ? process.env.APP_DEV_UI : undefined) ??
                'http://' + host + ':' + ready.httpPort;

            window = new BrowserWindow({
                width: 1440,
                height: 900,
                backgroundColor: '#252729',
                minWidth: 1280,
                minHeight: 720,
                show: false,
                webPreferences: {
                    contextIsolation: true,
                    sandbox: true,
                    nodeIntegration: false,
                    // A hidden test window must keep running at full speed.
                    backgroundThrottling: !hiddenWindows,
                },
            });
            setupSigner.attach(window, new URL(url).origin);
            window.webContents.setWindowOpenHandler(({ url: target }) => {
                if (/^https?:\/\//.test(target)) {
                    void shell.openExternal(target);
                }

                return { action: 'deny' };
            });
            window.webContents.on('will-navigate', (event, target) => {
                if (new URL(target).origin !== new URL(url).origin) {
                    event.preventDefault();
                }
            });
            window.webContents.on('will-attach-webview', (event) => event.preventDefault());
            await window.loadURL(url);

            if (!hiddenWindows) {
                window.show();
            }

            console.log('Application ready on HTTP port ' + ready.httpPort);
            backend.onExit(() => {
                if (quitting) {
                    return;
                }

                void (async () => {
                    const result = await dialog.showMessageBox({
                        type: 'error',
                        title: 'Server stopped',
                        message: 'The application server stopped. Retry to start it again.',
                        buttons: ['Retry', 'Quit'],
                        defaultId: 0,
                        cancelId: 1,
                    });

                    if (result.response === 0) {
                        restarting = true;
                        window?.destroy();
                        await launch(options);
                        restarting = false;
                    } else {
                        app.quit();
                    }
                })();
            });

            return;
        } catch (error) {
            await backend.close();
            const result = await dialog.showMessageBox({
                type: 'error',
                title: 'Server could not start',
                message: error instanceof Error ? error.message : 'The server failed to start.',
                detail: 'Check the configured port and data directory, then retry.',
                buttons: ['Retry', 'Quit'],
                defaultId: 0,
                cancelId: 1,
            });

            if (result.response === 1) {
                app.quit();

                return;
            }
        }
    }
}

// Runs one development data command without a window, reports in the terminal and exits.
async function maintain(dataDirectory: string, maintenance: DevelopmentMaintenance): Promise<void> {
    const worker = new BackendProcess(join(directory, 'worker.js'));
    let code = 0;

    try {
        const response = await worker.request(
            maintenance.type === 'reset'
                ? { type: 'dev-reset', dataDirectory }
                : { type: 'dev-import-v1', dataDirectory, source: maintenance.source },
            60 * 60,
        );

        if (response.type !== 'maintained') {
            throw new Error('Unexpected development data response.');
        }

        for (const line of response.report) {
            console.log(line);
        }
    } catch (error) {
        console.error(
            error instanceof Error ? error.message : 'The development data command failed.',
        );
        code = 1;
    } finally {
        await worker.close();
    }

    app.exit(code);
}

async function recovery(dataDirectory: string): Promise<void> {
    backend = new BackendProcess(join(directory, 'worker.js'));
    window = new BrowserWindow({
        width: 520,
        height: 500,
        resizable: false,
        backgroundColor: '#1d2022',
        show: !hiddenWindows,
        webPreferences: {
            backgroundThrottling: !hiddenWindows,
            preload: join(directory, 'recovery-preload.cjs'),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
        },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    let resetting = false;

    ipcMain.handle('administrator-recovery:reset', async (event, password: unknown) => {
        if (
            event.sender !== window?.webContents ||
            event.senderFrame !== window.webContents.mainFrame ||
            typeof password !== 'string' ||
            resetting
        ) {
            return { success: false, message: 'Invalid recovery request.' };
        }

        resetting = true;

        try {
            await backend!.request({
                type: 'recover',
                dataDirectory,
                version: app.getVersion(),
                password,
            });

            return {
                success: true,
                message:
                    'Password reset. Close this window, start the application normally, and sign in with the new temporary password.',
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Recovery failed.',
            };
        } finally {
            resetting = false;
        }
    });
    window.once('closed', () => ipcMain.removeHandler('administrator-recovery:reset'));
    await window.loadFile(join(app.getAppPath(), 'apps/desktop/assets/recovery.html'));
}
