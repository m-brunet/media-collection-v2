import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import type { DevelopmentMaintenance } from './configuration.util.js';
import { DesktopConfigurationParser } from './configuration.util.js';
import { DevelopmentDataGuard } from './development-data-guard.util.js';
import { BackendProcess } from './backend-process.adapter.js';
import { SetupRequestSigner } from './setup-request-signer.adapter.js';
import { MaintenanceWindow } from './maintenance-window.adapter.js';
import { KeepAwake } from './keep-awake.adapter.js';

// Automated tests run the real windows without putting them on screen.
const hiddenWindows = process.env.APP_HIDDEN_WINDOWS === '1';
const directory = dirname(fileURLToPath(import.meta.url));
// The Libris icon (apps/desktop/assets/icons) for every window: Windows reads the .ico, Linux the PNG.
const windowIcon = join(
    app.getAppPath(),
    'apps/desktop/assets/icons',
    process.platform === 'win32' ? 'libris.ico' : 'libris.png',
);

app.setName('Media Collection');
let backend: BackendProcess | undefined;
let quitting = false;
let shutdownComplete = false;
let window: BrowserWindow | undefined;
let restarting = false;
// The server is stopped while the local maintenance window is open.
let maintaining = false;
const setupSigner = new SetupRequestSigner();
const keepAwake = new KeepAwake();
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
        'The application is already running with this data directory. Close it before using local maintenance or development data commands.',
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
        if (!restarting && !maintaining) {
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

            if (options.localMaintenance) {
                await maintenanceWindow(options.dataDirectory).open();
                app.quit();
            } else {
                Menu.setApplicationMenu(applicationMenu(options));
                await launch(options);
            }
        } catch (error) {
            if (quitting) {
                return;
            }

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
        // The server reports the keep-awake setting at startup and on each change; a stopped server
        // (quit, maintenance, crash) no longer needs the computer awake.
        backend.onNotice((notice) => keepAwake.apply(notice.enabled));
        backend.onExit(() => keepAwake.release());

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
                icon: windowIcon,
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
                if (quitting || maintaining) {
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

function maintenanceWindow(dataDirectory: string): MaintenanceWindow {
    return new MaintenanceWindow({
        dataDirectory,
        workerPath: join(directory, 'worker.js'),
        preloadPath: join(directory, 'maintenance-preload.cjs'),
        pagePath: join(app.getAppPath(), 'apps/desktop/assets/maintenance.html'),
        iconPath: windowIcon,
        hidden: hiddenWindows,
    });
}

function applicationMenu(options: ReturnType<typeof DesktopConfigurationParser.parse>): Menu {
    return Menu.buildFromTemplate([
        ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
        { role: 'fileMenu' },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        {
            label: 'Maintenance',
            submenu: [
                {
                    id: 'local-maintenance',
                    label: 'Open local maintenance…',
                    click: () => void openMaintenance(options),
                },
            ],
        },
        { role: 'windowMenu' },
    ]);
}

// Stops the server and replaces the Libris window with the maintenance window, then starts the
// application again once maintenance is closed.
async function openMaintenance(
    options: ReturnType<typeof DesktopConfigurationParser.parse>,
): Promise<void> {
    if (maintaining || quitting) {
        return;
    }

    const answer = await dialog.showMessageBox({
        type: 'warning',
        title: 'Local maintenance',
        message: 'Open local maintenance?',
        detail: 'The server stops while maintenance is open: browsers and phones lose access until you close it. Unsaved changes in this window are lost.',
        buttons: ['Stop the server and open maintenance', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
    });

    if (answer.response !== 0 || maintaining || quitting) {
        return;
    }

    maintaining = true;

    try {
        await backend?.close();
        backend = undefined;
        const libris = window;
        const closed = maintenanceWindow(options.dataDirectory).open();

        libris?.destroy();
        await closed;

        if (!quitting) {
            await launch(options);
        }
    } finally {
        maintaining = false;
    }
}
