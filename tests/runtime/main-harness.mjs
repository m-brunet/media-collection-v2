import { app, dialog, Menu, powerSaveBlocker, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, unwatchFile, watchFile } from 'node:fs';
import { join } from 'node:path';

// Desktop UI assertions use English text, whatever the language of the test computer, unless the
// test asks for another device language.
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
const answers = { save: [], open: [], message: [] };
// The message boxes the application asked for, read through `dialogs`.
const shown = [];
const record = (options) =>
    shown.push({ title: options.title, message: options.message, buttons: options.buttons });

dialog.showMessageBox = async (...args) => {
    record(args.at(-1));

    return { response: 0, checkboxChecked: false };
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

// Folders and pages the application opens, read through `opened`, without opening anything on the
// test computer.
const opened = { paths: [], external: [] };

shell.openPath = async (path) => {
    opened.paths.push(path);

    return '';
};
shell.openExternal = async (url) => {
    opened.external.push(url);
};

// Records the sleep blockers the application holds, so tests can read them through `keep-awake`
// without the test computer's power settings changing.
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

let requestId = 0;
let window;
const send = (message) => process.stdout.write(JSON.stringify({ ...message, requestId }) + '\n');

app.on('browser-window-created', (_event, created) => {
    window = created;
    created.webContents.once('did-finish-load', () => {
        const url = new URL(created.webContents.getURL());
        const preferences = created.webContents.getLastWebPreferences();

        send({
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
        });
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

    try {
        if (request.type === 'evaluate') {
            send({
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
            send({ type: 'answered' });
        } else if (request.type === 'menu') {
            Menu.getApplicationMenu().getMenuItemById(request.id).click();
            send({ type: 'clicked' });
        } else if (request.type === 'key') {
            // A key press as the keyboard sends it, with modifiers such as `control`.
            for (const type of ['keyDown', 'char', 'keyUp']) {
                window.webContents.sendInputEvent({
                    type,
                    keyCode: request.keyCode,
                    modifiers: request.modifiers ?? [],
                });
            }

            send({ type: 'pressed' });
        } else if (request.type === 'opened') {
            send({ type: 'opened', value: opened });
        } else if (request.type === 'dialogs') {
            send({ type: 'dialogs', value: shown });
        } else if (request.type === 'menu-labels') {
            const labels = (menu) =>
                menu.items.map((item) => ({
                    id: item.id,
                    label: item.label,
                    role: item.role,
                    type: item.type,
                    ...(item.submenu ? { submenu: labels(item.submenu) } : {}),
                }));

            send({ type: 'menu-labels', value: labels(Menu.getApplicationMenu()) });
        } else if (request.type === 'window') {
            send({
                type: 'window',
                value: { url: window?.isDestroyed() ? null : window?.webContents.getURL() },
            });
        } else if (request.type === 'keep-awake') {
            send({ type: 'keep-awake', value: [...blockers.values()] });
        } else if (request.type === 'close-window') {
            window.close();
            send({ type: 'closed' });
        } else if (request.type === 'quit') {
            // Like the application menu's Quit: answers at once, the application may stay open.
            app.quit();
            send({ type: 'quitting' });
        } else if (request.type === 'stop') {
            app.quit();
        }
    } catch (error) {
        send({ type: 'failed', message: error.message });
    }
});
app.on('will-quit', () => {
    unwatchFile(process.env.APP_TEST_COMMAND_FILE);
    send({ type: 'stopped' });
});
await import('../../dist/apps/desktop/src/main.js');
