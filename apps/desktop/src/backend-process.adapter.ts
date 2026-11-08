import type { UtilityProcess } from 'electron';
import { utilityProcess } from 'electron';
import type { WorkerNotice, WorkerRequest, WorkerResponse } from './protocol.js';

export class WorkerFailure extends Error {
    constructor(
        message: string,
        readonly reason: string | null,
        readonly details: Record<string, unknown> | null,
    ) {
        super(message);
    }
}

export class BackendProcess {
    private readonly process: UtilityProcess;
    private exited = false;
    private readonly waiters = new Set<(message: WorkerResponse) => void>();
    private readonly exitListeners = new Set<() => void>();
    private readonly noticeListeners = new Set<(notice: WorkerNotice) => void>();

    constructor(workerPath: string) {
        this.process = utilityProcess.fork(workerPath, [], {
            serviceName: 'Application backend',
            stdio: 'pipe',
        });
        this.process.stdout?.on('data', (chunk) => process.stdout.write(chunk));
        this.process.stderr?.on('data', (chunk) => process.stderr.write(chunk));
        this.process.on('message', (message: WorkerResponse | WorkerNotice) => {
            // Notices are not answers: they must never settle a pending request.
            if (message.type === 'keep-awake') {
                for (const listener of this.noticeListeners) {
                    listener(message);
                }

                return;
            }

            for (const waiter of this.waiters) {
                waiter(message);
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

    onNotice(listener: (notice: WorkerNotice) => void): void {
        this.noticeListeners.add(listener);
    }

    // Long development data commands (downloading covers) allow more than the default 30 seconds.
    request(message: WorkerRequest, timeoutSeconds = 30): Promise<WorkerResponse> {
        if (this.exited) {
            return Promise.reject(new Error('The backend process has stopped.'));
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.waiters.delete(receive);
                reject(
                    new Error('The backend did not respond within ' + timeoutSeconds + ' seconds.'),
                );
            }, timeoutSeconds * 1000);
            const receive = (response: WorkerResponse) => {
                clearTimeout(timeout);
                this.waiters.delete(receive);

                if (response.type === 'failed') {
                    reject(
                        new WorkerFailure(
                            response.message,
                            response.reason ?? null,
                            response.details ?? null,
                        ),
                    );
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
