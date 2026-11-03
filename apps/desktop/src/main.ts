import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { DesktopConfigurationParser } from './configuration.util.js';
import { BackendProcess } from './backend-process.adapter.js';

const directory = dirname(fileURLToPath(import.meta.url));

app.setName('Electron Base');
let backend: BackendProcess | undefined;
let quitting = false;
let shutdownComplete = false;
let window: BrowserWindow | undefined;
let restarting = false;
const startupOptions = (() => {
    try {
        const defaultData = app.isPackaged
            ? app.getPath('userData')
            : join(app.getAppPath(), '.dev-data');
        const options = DesktopConfigurationParser.parse(
            process.argv.slice(1),
            process.env,
            defaultData,
        );

        if (options.recoveryLogin && !existsSync(options.dataDirectory)) {
            throw new Error('Recovery requires an existing data directory.');
        }

        const profile = join(options.dataDirectory, 'electron-profile');

        mkdirSync(profile, { recursive: true, mode: 0o700 });
        app.setPath('userData', profile);

        return options;
    } catch (error) {
        dialog.showErrorBox(
            'Invalid application configuration',
            error instanceof Error ? error.message : 'Configuration failed.',
        );

        return undefined;
    }
})();

if (!startupOptions) {
    app.exit(1);
} else if (!app.requestSingleInstanceLock()) {
    console.error('The application is already running. Close it before using recovery.');
    app.exit(1);
} else {
    app.on('second-instance', () => {
        window?.show();
        window?.focus();
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
                await recovery(options.dataDirectory, options.recoveryLogin);
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
                width: 1100,
                height: 800,
                minWidth: 700,
                minHeight: 550,
                show: false,
                webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
            });
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
            window.show();
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

async function recovery(dataDirectory: string, login: string): Promise<void> {
    backend = new BackendProcess(join(directory, 'worker.js'));
    window = new BrowserWindow({
        width: 520,
        height: 430,
        resizable: false,
        webPreferences: {
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
            await backend!.request({ type: 'recover', dataDirectory, login, password });

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
