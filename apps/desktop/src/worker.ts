import type { BackendHandle } from '../../server/src/infrastructure/config/bootstrap.js';
import { BackendRuntime } from '../../server/src/infrastructure/config/bootstrap.js';
import { LocalMaintenance } from '../../server/src/infrastructure/config/maintenance.js';
import { DevelopmentDataCommands } from '../../server/src/infrastructure/config/development-data.js';
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
                backend = await new BackendRuntime().start(message);
                send({
                    type: 'ready',
                    httpPort: backend.httpPort,
                    httpsPort: backend.httpsPort,
                    httpsError: backend.httpsError,
                });
            } else if (
                message.type === 'maintenance-status' ||
                message.type === 'recover' ||
                message.type === 'backup' ||
                message.type === 'inspect-backup' ||
                message.type === 'restore-backup'
            ) {
                if (starting) {
                    throw new Error('Maintenance cannot run with the server active.');
                }

                const maintenance = new LocalMaintenance(message.dataDirectory, message.version);

                if (message.type === 'maintenance-status') {
                    send({ type: 'maintenance-status', ...(await maintenance.status()) });
                } else if (message.type === 'recover') {
                    send({
                        type: 'recovered',
                        username: (await maintenance.recover(message.password)).username,
                    });
                } else if (message.type === 'backup') {
                    send({
                        type: 'backed-up',
                        backup: await maintenance.createBackup(message.destination),
                    });
                } else if (message.type === 'inspect-backup') {
                    send({
                        type: 'backup-inspected',
                        backup: await maintenance.inspectBackup(message.source),
                    });
                } else {
                    send({
                        type: 'restored',
                        backup: await maintenance.restoreBackup(message.source),
                    });
                }
            } else if (message.type === 'dev-reset' || message.type === 'dev-import-v1') {
                if (starting) {
                    throw new Error('Development data commands cannot run with the server active.');
                }

                const report =
                    message.type === 'dev-reset'
                        ? await DevelopmentDataCommands.reset(message.dataDirectory)
                        : await DevelopmentDataCommands.importV1(
                              message.dataDirectory,
                              message.source,
                          );

                send({ type: 'maintained', report });
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
