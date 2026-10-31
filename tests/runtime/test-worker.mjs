import { startBackend } from '../../dist/apps/server/src/infrastructure/config/bootstrap.js';

const parent = process.parentPort;
let offset = 0;
let backend;
const clock = { now: () => new Date(Date.now() + offset) };

parent.on('message', async (event) => {
    const message = event.data;

    try {
        if (message.type === 'start') {
            backend = await startBackend({ ...message, clock });
            parent.postMessage({
                type: 'ready',
                httpPort: backend.httpPort,
                httpsPort: backend.httpsPort,
                httpsError: backend.httpsError,
            });
        } else if (message.type === 'advance') {
            offset += message.milliseconds;
            parent.postMessage({ type: 'advanced' });
        } else if (message.type === 'stop') {
            await backend.close();
            parent.postMessage({ type: 'stopped' });
            process.exit(0);
        }
    } catch (error) {
        parent.postMessage({ type: 'failed', message: error.message });
    }
});
