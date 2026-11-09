import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface RuntimeMessage {
    type: string;
    httpPort: number;
    httpsPort: number | null;
    httpsError: string | null;
    message?: string;
    requestId: number;
    value?: unknown;
}

const electron = createRequire(import.meta.url)('electron') as string;

export interface RuntimeOptions {
    maintenance?: boolean;
    fakeClock?: boolean;
    port?: number | null;
    main?: boolean;
    environmentPort?: number;
    // Where Find book asks BnF and Open Library: a local stand-in instead of the real catalogues.
    lookupAddresses?: { bnf: string; openLibrary: string };
    // Stand-ins for the router, Let's Encrypt and the public address service.
    // `domainAddress`: where every domain name points (default: the external address).
    internetAccess?: { externalAddress: string | null; accepts: boolean; domainAddress?: string };
}

export class ElectronRuntime {
    readonly exited: Promise<number | null>;
    readonly ready: Promise<RuntimeMessage>;
    private readonly child: ChildProcessWithoutNullStreams;
    private readonly pending = new Map<
        number,
        {
            resolve(value: RuntimeMessage): void;
            reject(error: Error): void;
            timer: ReturnType<typeof setTimeout>;
        }
    >();
    private counter = 0;
    private errors = '';

    constructor(
        readonly dataDirectory: string,
        options: RuntimeOptions = {},
    ) {
        const environment: Record<string, string | undefined> = {
            ...process.env,
            APP_TEST_DATA: dataDirectory,
            APP_TEST_COMMAND_FILE: join(dataDirectory, 'test-command.json'),
            APP_TEST_PORT: options.port === null ? undefined : String(options.port ?? 0),
            APP_TEST_MAINTENANCE: options.maintenance ? '1' : '0',
            APP_TEST_FAKE_CLOCK: options.fakeClock ? '1' : '0',
            APP_TEST_LOOKUP_ADDRESSES: options.lookupAddresses
                ? JSON.stringify(options.lookupAddresses)
                : undefined,
            APP_TEST_INTERNET_ACCESS: options.internetAccess
                ? JSON.stringify(options.internetAccess)
                : undefined,
            APP_HIDDEN_WINDOWS: '1',
        };

        delete environment.ELECTRON_RUN_AS_NODE;
        delete environment.APP_DEV_UI;
        delete environment.APP_HTTP_PORT;
        delete environment.APP_HOST;
        delete environment.APP_DATA_DIR;

        if (options.environmentPort !== undefined) {
            environment.APP_HTTP_PORT = String(options.environmentPort);
        }

        this.child = spawn(
            electron,
            options.main
                ? [
                      fileURLToPath(new URL('../runtime/main-harness.mjs', import.meta.url)),
                      '--data-dir',
                      dataDirectory,
                      ...(options.port === null || options.port === undefined
                          ? []
                          : ['--http-port', String(options.port)]),
                      '--host',
                      '0.0.0.0',
                      ...(options.maintenance ? ['--maintenance'] : []),
                  ]
                : [fileURLToPath(new URL('../runtime/harness.mjs', import.meta.url))],
            { env: environment, stdio: 'pipe' },
        );
        this.ready = this.wait(0);
        this.exited = new Promise((resolve) => this.child.once('exit', resolve));
        this.child.stderr.on('data', (data) => {
            this.errors = (this.errors + String(data)).slice(-8000);
        });
        this.child.once('error', (error) => this.rejectAll(error));
        this.child.stdin.on('error', (error) => this.rejectAll(error));
        this.child.once('exit', (code) =>
            this.rejectAll(new Error('Electron exited (' + code + '): ' + this.errors)),
        );
        createInterface({ input: this.child.stdout }).on('line', (line) => {
            if (!line.startsWith('{')) {
                return;
            }

            const message = JSON.parse(line) as RuntimeMessage;
            const pending = this.pending.get(message.requestId);

            if (!pending) {
                return;
            }

            clearTimeout(pending.timer);
            this.pending.delete(message.requestId);

            if (message.type === 'failed') {
                pending.reject(new Error(message.message));
            } else {
                pending.resolve(message);
            }
        });
    }

    async send(message: object): Promise<RuntimeMessage> {
        const requestId = ++this.counter;
        const response = this.wait(requestId);

        writeFileSync(
            join(this.dataDirectory, 'test-command.json'),
            JSON.stringify({ ...message, requestId }),
        );

        return response;
    }

    async close(): Promise<void> {
        if (this.child.exitCode !== null || this.child.killed) {
            return;
        }

        try {
            await this.send({ type: 'stop' });
            await this.exited;
        } finally {
            this.child.kill();
        }
    }

    private rejectAll(error: Error): void {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }

        this.pending.clear();
    }

    private wait(id: number): Promise<RuntimeMessage> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.child.kill();
                this.pending.delete(id);
                reject(new Error('Electron operation timed out: ' + this.errors));
            }, 25000);

            this.pending.set(id, { resolve, reject, timer });
        });
    }
}

export { Client } from './client.js';
