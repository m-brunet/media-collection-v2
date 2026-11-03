import type { UtilityProcess } from 'electron';
import { utilityProcess } from 'electron';
import type { WorkerRequest, WorkerResponse } from './protocol.js';

export class BackendProcess {
    private readonly process: UtilityProcess;
    private exited = false;
    private readonly waiters = new Set<(message: WorkerResponse) => void>();
    private readonly exitListeners = new Set<() => void>();

    constructor(workerPath: string) {
        this.process = utilityProcess.fork(workerPath, [], {
            serviceName: 'Application backend',
            stdio: 'pipe',
        });
        this.process.stdout?.on('data', (chunk) => process.stdout.write(chunk));
        this.process.stderr?.on('data', (chunk) => process.stderr.write(chunk));
        this.process.on('message', (message) => {
            for (const waiter of this.waiters) {
                waiter(message as WorkerResponse);
            }
        });
        this.process.on('exit', () => {
            this.exited = true;

            for (const waiter of this.waiters) {
                waiter({ type: 'failed', message: 'The backend process stopped unexpectedly.' });
            }

            for (const listener of this.exitListeners) {
                listener();
            }
        });
    }

    onExit(listener: () => void): void {
        this.exitListeners.add(listener);
    }

    request(message: WorkerRequest): Promise<WorkerResponse> {
        if (this.exited) {
            return Promise.reject(new Error('The backend process has stopped.'));
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.waiters.delete(receive);
                reject(new Error('The backend did not respond within 30 seconds.'));
            }, 30000);
            const receive = (response: WorkerResponse) => {
                clearTimeout(timeout);
                this.waiters.delete(receive);

                if (response.type === 'failed') {
                    reject(new Error(response.message));
                } else {
                    resolve(response);
                }
            };

            this.waiters.add(receive);
            this.process.postMessage(message);
        });
    }

    async close(): Promise<void> {
        if (this.exited) {
            return;
        }

        try {
            await Promise.race([
                this.request({ type: 'stop' }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Shutdown timed out.')), 7000).unref(),
                ),
            ]);
        } finally {
            if (!this.exited) {
                this.process.kill();
            }
        }
    }
}
