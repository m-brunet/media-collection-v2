import { app, BrowserWindow, dialog, Menu, powerSaveBlocker, shell, Tray } from 'electron';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, unwatchFile, watchFile } from 'node:fs';
import { join } from 'node:path';

const language = process.env.APP_TEST_LANGUAGE || 'en-GB';

app.commandLine.appendSwitch('lang', language);
app.getPreferredSystemLanguages = () => [language];
// Match the app directory used by `electron .`; the test entry itself lives below tests/.
app.getAppPath = () => fileURLToPath(new URL('../../', import.meta.url));
// `electron .` reports the package version; this harness entry would report Electron's own.
const { version } = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);

app.getVersion = () => version;

// Native dialogs cannot be clicked in hidden test windows: confirmations are accepted, and file
// dialogs answer with the paths the test queued through `answer-dialogs`.
const documents = join(process.env.APP_TEST_DATA, 'test-documents');

mkdirSync(documents, { recursive: true });
app.setPath('documents', documents);
const answers = {
    save: [],
    open: [],
    message: JSON.parse(process.env.APP_TEST_DIALOG_ANSWERS || '[]'),
};
const shown = [];
const record = (options) =>
    shown.push({
        title: options.title,
        message: options.message,
        detail: options.detail,
        buttons: options.buttons,
    });

dialog.showMessageBox = async (...args) => {
    record(args.at(-1));

    return { response: answers.message.shift() ?? 0, checkboxChecked: false };
};
dialog.showMessageBoxSync = (...args) => {
    record(args.at(-1));

    return answers.message.shift() ?? 0;
};
process.on('uncaughtException', (error) => {
    process.stderr.write('Uncaught main process error: ' + (error?.stack ?? error) + '\n');
    app.exit(1);
});
dialog.showErrorBox = (title, content) => {
    process.stderr.write(title + ': ' + content + '\n');
};
dialog.showSaveDialog = async () => {
    const filePath = answers.save.shift();

    return { canceled: filePath === undefined, filePath };
};
dialog.showOpenDialog = async () => {
    const filePath = answers.open.shift();

    return { canceled: filePath === undefined, filePaths: filePath ? [filePath] : [] };
};

const opened = { paths: [], external: [] };

shell.openPath = async (path) => {
    opened.paths.push(path);

    return '';
};
shell.openExternal = async (url) => {
    opened.external.push(url);
};

const blockers = new Map();
let nextBlocker = 1;

powerSaveBlocker.start = (type) => {
    const id = nextBlocker++;

    blockers.set(id, type);

    return id;
};
powerSaveBlocker.stop = (id) => {
    blockers.delete(id);
};
powerSaveBlocker.isStarted = (id) => blockers.has(id);

// The login item is the person's real Windows Run key: tests keep it in memory instead.
const loginItem = { openAtLogin: false, args: [], name: null };

app.getLoginItemSettings = () => ({
    openAtLogin: loginItem.openAtLogin,
    executableWillLaunchAtLogin: loginItem.openAtLogin,
    launchItems: [],
    wasOpenedAtLogin: false,
    status: 'not-registered',
});
app.setLoginItemSettings = (settings) => {
    loginItem.openAtLogin = settings.openAtLogin === true;
    loginItem.args = settings.args ?? [];
    loginItem.name = settings.name ?? null;
};

const trayState = { tray: null, menu: null, balloons: [] };
const setContextMenu = Tray.prototype.setContextMenu;

Tray.prototype.setContextMenu = function (menu) {
    trayState.tray = this;
    trayState.menu = menu;
    setContextMenu.call(this, menu);
};
Tray.prototype.displayBalloon = function (options) {
    trayState.balloons.push({ title: options.title, content: options.content });
};

let requestId = 0;
let window;
const labels = (menu) =>
    menu.items.map((item) => ({
        id: item.id,
        label: item.label,
        role: item.role,
        type: item.type,
        enabled: item.enabled,
        ...(item.type === 'checkbox' ? { checked: item.checked } : {}),
        ...(item.submenu ? { submenu: labels(item.submenu) } : {}),
    }));
const send = (message, id = requestId) =>
    process.stdout.write(JSON.stringify({ ...message, requestId: id }) + '\n');

app.on('browser-window-created', (_event, created) => {
    window = created;
    created.webContents.once('did-finish-load', () => {
        const url = new URL(created.webContents.getURL());
        const preferences = created.webContents.getLastWebPreferences();

        send(
            {
                type: 'window-ready',
                httpPort: Number(url.port),
                value: {
                    nodeIntegration: preferences.nodeIntegration,
                    sandbox: preferences.sandbox,
                    contextIsolation: preferences.contextIsolation,
                    maintenance: url.protocol === 'file:',
                    minimumSize: created.getMinimumSize(),
                    applicationName: app.getName(),
                },
            },
            0,
        );
    });
});
watchFile(process.env.APP_TEST_COMMAND_FILE, { interval: 20 }, async () => {
    let request;

    try {
        request = JSON.parse(readFileSync(process.env.APP_TEST_COMMAND_FILE, 'utf8'));
    } catch {
        return;
    }

    if (request.requestId <= requestId) {
        return;
    }

    requestId = request.requestId;
    const reply = (message) => send(message, request.requestId);

    try {
        if (request.type === 'evaluate') {
            reply({
                type: 'evaluated',
                // `userGesture` gives the page the user activation some browser features need (a
                // `beforeunload` prompt is only shown after the person has interacted with the page).
                value: await window.webContents.executeJavaScript(
                    request.expression,
                    request.userGesture === true,
                ),
            });
        } else if (request.type === 'answer-dialogs') {
            answers.save.push(...(request.save ?? []));
            answers.open.push(...(request.open ?? []));
            answers.message.push(...(request.message ?? []));
            reply({ type: 'answered' });
        } else if (request.type === 'menu') {
            Menu.getApplicationMenu().getMenuItemById(request.id).click();
            reply({ type: 'clicked' });
        } else if (request.type === 'key') {
            for (const type of ['keyDown', 'char', 'keyUp']) {
                window.webContents.sendInputEvent({
                    type,
                    keyCode: request.keyCode,
                    modifiers: request.modifiers ?? [],
                });
            }

            reply({ type: 'pressed' });
        } else if (request.type === 'opened') {
            reply({ type: 'opened', value: opened });
        } else if (request.type === 'dialogs') {
            reply({ type: 'dialogs', value: shown });
        } else if (request.type === 'menu-labels') {
            reply({ type: 'menu-labels', value: labels(Menu.getApplicationMenu()) });
        } else if (request.type === 'tray') {
            reply({
                type: 'tray',
                value: {
                    menu: trayState.menu ? labels(trayState.menu) : null,
                    balloons: trayState.balloons,
                },
            });
        } else if (request.type === 'tray-menu') {
            trayState.menu.getMenuItemById(request.id).click();
            reply({ type: 'clicked' });
        } else if (request.type === 'tray-click') {
            trayState.tray.emit('click');
            reply({ type: 'clicked' });
        } else if (request.type === 'login-item') {
            reply({ type: 'login-item', value: loginItem });
        } else if (request.type === 'windows') {
            reply({
                type: 'windows',
                value: BrowserWindow.getAllWindows().map((each) => ({
                    title: each.getTitle(),
                    url: each.webContents.getURL(),
                })),
            });
        } else if (request.type === 'window') {
            reply({
                type: 'window',
                value: { url: window?.isDestroyed() ? null : window?.webContents.getURL() },
            });
        } else if (request.type === 'keep-awake') {
            reply({ type: 'keep-awake', value: [...blockers.values()] });
        } else if (request.type === 'close-window') {
            window.close();
            reply({ type: 'closed' });
        } else if (request.type === 'quit') {
            app.quit();
            reply({ type: 'quitting' });
        } else if (request.type === 'stop') {
            app.quit();
        }
    } catch (error) {
        reply({ type: 'failed', message: error.message });
    }
});
app.on('will-quit', () => {
    unwatchFile(process.env.APP_TEST_COMMAND_FILE);
    send({ type: 'stopped' });
});
await import('../../dist/apps/desktop/src/main.js');
