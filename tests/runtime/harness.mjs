import { app, utilityProcess } from 'electron';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, unwatchFile, watchFile } from 'node:fs';
import { join } from 'node:path';

const userData = join(process.env.APP_TEST_DATA, 'electron-test-profile');

mkdirSync(userData, { recursive: true });
app.setPath('userData', userData);
void app
    .whenReady()
    .then(() => {
        const workerPath =
            process.env.APP_TEST_FAKE_CLOCK === '1' ||
            process.env.APP_TEST_LOOKUP_ADDRESSES ||
            process.env.APP_TEST_INTERNET_ACCESS
                ? fileURLToPath(new URL('./test-worker.mjs', import.meta.url))
                : fileURLToPath(new URL('../../dist/apps/desktop/src/worker.js', import.meta.url));
        const worker = utilityProcess.fork(workerPath, [], { stdio: 'pipe' });

        worker.stderr.on('data', (chunk) => process.stderr.write(chunk));
        worker.stdout.on('data', (chunk) => process.stderr.write(chunk));
        let requestId = 0;
        let stopping = false;

        worker.on('message', (message) => {
            if (message.type === 'keep-awake') {
                return;
            }

            process.stdout.write(JSON.stringify({ ...message, requestId }) + '\n');

            if (message.type === 'stopped') {
                stopping = true;
                app.quit();
            }
        });
        worker.on('exit', (code) => {
            if (!stopping) {
                process.stdout.write(
                    JSON.stringify({
                        type: 'failed',
                        message: 'Utility process exited: ' + code,
                        requestId,
                    }) + '\n',
                );
            }

            app.exit(code || 0);
        });
        watchFile(process.env.APP_TEST_COMMAND_FILE, { interval: 20 }, () => {
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
            delete request.requestId;
            worker.postMessage(request);
        });
        app.on('will-quit', () => unwatchFile(process.env.APP_TEST_COMMAND_FILE));

        if (process.env.APP_TEST_MAINTENANCE === '1') {
            process.stdout.write(
                JSON.stringify({ type: 'maintenance-ready', requestId: 0 }) + '\n',
            );
        } else {
            worker.postMessage({
                type: 'start',
                dataDirectory: process.env.APP_TEST_DATA,
                host: '0.0.0.0',
                ...(process.env.APP_TEST_PORT === undefined
                    ? {}
                    : { httpPort: Number(process.env.APP_TEST_PORT) }),
                webDirectory: fileURLToPath(new URL('../../dist/apps/web/', import.meta.url)),
                development: false,
                setupToken: 'test-setup-token',
            });
        }
    })
    .catch((error) => {
        console.error(error);
        app.exit(1);
    });
