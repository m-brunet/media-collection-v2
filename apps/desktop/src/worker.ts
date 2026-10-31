import type { BackendHandle } from '../../server/src/infrastructure/config/bootstrap.js';
import { startBackend } from '../../server/src/infrastructure/config/bootstrap.js';
import { recoverAdministrator } from '../../server/src/infrastructure/config/recovery.js';
import type { WorkerRequest, WorkerResponse } from './protocol.js';

const parent = process.parentPort;

if (!parent) {
    throw new Error('The backend must be launched as an Electron utility process.');
}

let backend: BackendHandle | undefined;
let starting = false;
let operation: Promise<void> = Promise.resolve();
const send = (response: WorkerResponse) => parent.postMessage(response);

parent.on('message', (event) => {
    const message = event.data as WorkerRequest;

    operation = operation.then(async () => {
        try {
            if (message.type === 'start') {
                if (starting) {
                    throw new Error('The backend has already been started.');
                }

                starting = true;
                backend = await startBackend(message);
                send({
                    type: 'ready',
                    httpPort: backend.httpPort,
                    httpsPort: backend.httpsPort,
                    httpsError: backend.httpsError,
                });
            } else if (message.type === 'recover') {
                if (starting) {
                    throw new Error('Recovery cannot run with the server active.');
                }

                await recoverAdministrator(message.dataDirectory, message.login, message.password);
                send({ type: 'recovered' });
            } else if (message.type === 'stop') {
                await backend?.close();
                send({ type: 'stopped' });
                process.exit(0);
            }
        } catch (error) {
            send({
                type: 'failed',
                message: error instanceof Error ? error.message : 'The backend operation failed.',
            });
        }
    });
});
