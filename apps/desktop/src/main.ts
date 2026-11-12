import { app, BrowserWindow, dialog, Menu, shell, Tray } from 'electron';
import type { UpdateSource } from './application-updates.service.js';
import type { UpdateMenuState } from './application-menu.adapter.js';
import { ApplicationUpdates } from './application-updates.service.js';
import { ElectronUpdaterSource } from './electron-updater-source.adapter.js';
import { ScriptedUpdateSource } from './scripted-update-source.adapter.js';
import { NativeUpdateDialogs } from './update-dialogs.adapter.js';
import { UpdateBackup } from './update-backup.adapter.js';
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
import { DesktopLanguage } from './desktop-language.util.js';
import { DesktopTexts } from './desktop-texts.util.js';
import { ApplicationMenu } from './application-menu.adapter.js';
import { BackupFolder } from './backup-folder.adapter.js';
import { AboutWindow } from './about-window.adapter.js';
import { BackgroundMode } from './background-mode.service.js';
import { DesktopTray } from './desktop-tray.adapter.js';
import { HiddenTray } from './hidden-tray.adapter.js';
import { LaunchAtStartup } from './launch-at-startup.adapter.js';
import { TrayNotice } from './tray-notice.adapter.js';

const hiddenWindows = process.env.APP_HIDDEN_WINDOWS === '1';
const directory = dirname(fileURLToPath(import.meta.url));
// Windows reads the .ico, Linux the PNG.
const windowIcon = join(
    app.getAppPath(),
    'apps/desktop/assets/icons',
    process.platform === 'win32' ? 'libris.ico' : 'libris.png',
);

app.setName('Media Collection');
const texts = new DesktopTexts(DesktopLanguage.of(app.getPreferredSystemLanguages()));
let backend: BackendProcess | undefined;
let quitting = false;
let shutdownComplete = false;
let window: BrowserWindow | undefined;
let restarting = false;
let maintaining = false;
let quitRequested = false;
let updateMenuState: UpdateMenuState = { kind: 'off' };
let applicationMenu: ApplicationMenu | undefined;
const windowsTray = process.platform === 'win32';
const background = new BackgroundMode(windowsTray, process.argv.includes(LaunchAtStartup.argument));
const launchAtStartup = windowsTray
    ? new LaunchAtStartup(app.isPackaged || process.env.APP_TEST_LOGIN_ITEMS === '1')
    : undefined;
const tray = launchAtStartup
    ? new DesktopTray(
          texts,
          windowIcon,
          launchAtStartup,
          {
              open: () => showWindow(),
              setLaunchAtStartup: (enabled) => setLaunchAtStartup(enabled),
              quit: () => app.quit(),
          },
          hiddenWindows ? () => new HiddenTray() : (iconPath) => new Tray(iconPath),
      )
    : undefined;
const setupSigner = new SetupRequestSigner();
const keepAwake = new KeepAwake();
const backupFolder = new BackupFolder(app.getPath('documents'));
const aboutWindow = new AboutWindow({
    preloadPath: join(directory, 'about-preload.cjs'),
    pagePath: join(app.getAppPath(), 'apps/desktop/assets/about.html'),
    iconPath: windowIcon,
    hidden: hiddenWindows,
    texts,
    openCredits: () => openCredits(),
});
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
        const message = error instanceof Error ? error.message : texts.text('configurationFailed');

        if (commandLine) {
            console.error(message);
        } else {
            dialog.showErrorBox(texts.text('invalidConfigurationTitle'), message);
        }

        return undefined;
    }
})();

if (!startupOptions) {
    app.exit(1);
} else if (!app.requestSingleInstanceLock()) {
    console.error(
        'The application is already running with this data directory. Close it before using local maintenance or development data commands.',
    );
    app.exit(1);
} else if (startupOptions.maintenance) {
    const { dataDirectory, maintenance } = startupOptions;

    void app.whenReady().then(() => maintain(dataDirectory, maintenance));
} else {
    app.on('second-instance', (_event, argv) => {
        if (!argv.includes(LaunchAtStartup.argument)) {
            showWindow();
        }
    });
    app.on('window-all-closed', () => {
        if (quitRequested || (!restarting && !maintaining)) {
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

        if (window && !window.isDestroyed()) {
            quitRequested = true;
            window.close();

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
    app.on('will-quit', () => tray?.destroy());
    process.on('SIGTERM', () => app.quit());
    process.on('SIGINT', () => app.quit());
    void app.whenReady().then(async () => {
        try {
            const options = startupOptions;

            if (options.localMaintenance) {
                await maintenanceWindow(options.dataDirectory).open();
                app.quit();
            } else {
                tray?.show();

                const updates = applicationUpdates(options);

                await launch(options);

                if (updates) {
                    setTimeout(
                        () => void updates.checkAtStartup(),
                        process.env.APP_TEST_UPDATES ? 0 : 5000,
                    );
                }
            }
        } catch (error) {
            if (quitting) {
                return;
            }

            dialog.showErrorBox(
                texts.text('startFailedTitle'),
                error instanceof Error ? error.message : texts.text('unknownStartupError'),
            );
            app.quit();
        }
    });
}

async function launch(options: ReturnType<typeof DesktopConfigurationParser.parse>): Promise<void> {
    while (!quitting) {
        backend = new BackendProcess(join(directory, 'worker.js'));
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
            window.on('session-end', () => {
                quitRequested = true;
            });
            window.on('close', (event) => {
                if (!background.keepsRunningOnClose(quitRequested || quitting)) {
                    return;
                }

                event.preventDefault();
                window?.hide();
                notifyKeepsRunning();
            });
            // A page with unsaved changes (the book form) blocks closing through `beforeunload`;
            // Electron shows no prompt of its own, so ask here. The answer must be synchronous.
            window.webContents.on('will-prevent-unload', (event) => {
                if (!hiddenWindows) {
                    window?.show();
                }

                const choice = dialog.showMessageBoxSync(window!, {
                    type: 'question',
                    title: texts.text('unsavedTitle'),
                    message: texts.text('unsavedMessage'),
                    detail: texts.text('unsavedDetail'),
                    buttons: [texts.text('unsavedLeave'), texts.text('unsavedStay')],
                    defaultId: 1,
                    cancelId: 1,
                });

                if (choice === 0) {
                    event.preventDefault();
                } else {
                    quitRequested = false;
                }
            });
            await window.loadURL(url);

            if (background.revealsOnLaunch() && !hiddenWindows) {
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
                        title: texts.text('serverStoppedTitle'),
                        message: texts.text('serverStoppedMessage'),
                        buttons: [texts.text('retry'), texts.text('quit')],
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
                title: texts.text('serverStartTitle'),
                message: error instanceof Error ? error.message : texts.text('serverStartFallback'),
                detail: texts.text('serverStartDetail'),
                buttons: [texts.text('retry'), texts.text('quit')],
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
        texts,
        backupFolder,
    });
}

// electron-updater reads the release information embedded in a packaged application only; test
// launches script the releases instead (`APP_TEST_UPDATES`).
function applicationUpdates(
    options: ReturnType<typeof DesktopConfigurationParser.parse>,
): ApplicationUpdates | undefined {
    const scripted = !app.isPackaged
        ? ScriptedUpdateSource.fromEnvironment(process.env.APP_TEST_UPDATES)
        : undefined;
    const backup = new UpdateBackup({
        workerPath: join(directory, 'worker.js'),
        dataDirectory: options.dataDirectory,
        folder: backupFolder,
    });

    applicationMenu = new ApplicationMenu(
        texts,
        {
            openAbout: () => void aboutWindow.open(window),
            updates: () => void updates.chooseFromMenu(),
            openMaintenance: () => void openMaintenance(options),
            setLaunchAtStartup: (enabled) => setLaunchAtStartup(enabled),
        },
        launchAtStartup,
    );

    if (!app.isPackaged && !scripted) {
        refreshMenus();

        return undefined;
    }

    const source: UpdateSource = scripted ?? new ElectronUpdaterSource();
    const updates: ApplicationUpdates = new ApplicationUpdates(
        source,
        new NativeUpdateDialogs(texts),
        {
            stopServer: () => stopServerForUpdate(),
            backup: (update) => backup.make(update),
            startServer: () => startServerAfterUpdate(options),
            openPage: (address) => shell.openExternal(address),
        },
        (state) => {
            updateMenuState = state;
            refreshMenus();
        },
    );

    updateMenuState = updates.current();
    refreshMenus();

    return updates;
}

function refreshMenus(): void {
    if (applicationMenu) {
        Menu.setApplicationMenu(applicationMenu.build(updateMenuState));
    }

    tray?.refresh();
}

function setLaunchAtStartup(enabled: boolean): void {
    launchAtStartup?.set(enabled);
    refreshMenus();
}

function showWindow(): void {
    if (!window || window.isDestroyed() || maintaining || hiddenWindows) {
        return;
    }

    window.show();
    window.focus();
}

function notifyKeepsRunning(): void {
    const notice = new TrayNotice(app.getPath('userData'));

    if (notice.due()) {
        tray?.notifyKeepsRunning();
        notice.shown();
    }
}

async function stopServerForUpdate(): Promise<void> {
    maintaining = true;
    await backend?.close();
    backend = undefined;
    window?.destroy();
}

async function startServerAfterUpdate(
    options: ReturnType<typeof DesktopConfigurationParser.parse>,
): Promise<void> {
    try {
        if (!quitting) {
            await launch(options);
        }
    } finally {
        maintaining = false;
    }
}

function openCredits(): void {
    if (!window || window.isDestroyed()) {
        return;
    }

    void window.loadURL(new URL('/credits', window.webContents.getURL()).href);

    if (!hiddenWindows) {
        window.show();
        window.focus();
    }
}

async function openMaintenance(
    options: ReturnType<typeof DesktopConfigurationParser.parse>,
): Promise<void> {
    if (maintaining || quitting) {
        return;
    }

    const answer = await dialog.showMessageBox({
        type: 'warning',
        title: texts.text('maintenanceTitle'),
        message: texts.text('maintenanceMessage'),
        detail: texts.text('maintenanceDetail'),
        buttons: [texts.text('maintenanceConfirm'), texts.text('cancel')],
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
