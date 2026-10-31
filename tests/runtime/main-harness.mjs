import { app } from 'electron';
import { fileURLToPath } from 'node:url';
import { readFileSync, unwatchFile, watchFile } from 'node:fs';

// Match the app directory used by `electron .`; the test entry itself lives below tests/.
app.getAppPath = () => fileURLToPath(new URL('../../', import.meta.url));
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
                recovery: url.protocol === 'file:'
            }
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
                value: await window.webContents.executeJavaScript(request.expression)
            });
        } else if (request.type === 'stop') {
            if (window) {
                window.close();
            } else {
                app.quit();
            }
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
