import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from 'selfsigned';
import { createServer } from 'node:net';
import type { RuntimeOptions } from './runtime.js';
import { Client, ElectronRuntime } from './runtime.js';
import { desktopWindow } from './client.js';
import { appVersion } from './app-version.js';

export class RuntimeFixture {
    private readonly directories = new Set<string>();
    private readonly runtimes: ElectronRuntime[] = [];

    async directory(): Promise<string> {
        const directory = await mkdtemp(join(tmpdir(), 'electron-runtime-test-'));

        this.directories.add(directory);

        return directory;
    }

    async start(directory?: string, options: RuntimeOptions = {}) {
        const data = directory ?? (await this.directory());
        const resolved =
            options.main && !options.maintenance && options.port === undefined
                ? { ...options, port: await RuntimeSetup.availablePort() }
                : options;
        const runtime = this.launch(data, resolved);
        const ready = await runtime.ready;

        return {
            runtime,
            directory: data,
            ready,
            client: new Client('http://127.0.0.1:' + ready.httpPort),
        };
    }

    launch(directory: string, options: RuntimeOptions = {}): ElectronRuntime {
        const runtime = new ElectronRuntime(directory, options);

        this.runtimes.push(runtime);

        return runtime;
    }

    async restart(
        current: { runtime: ElectronRuntime; directory: string },
        options: RuntimeOptions = {},
    ) {
        await current.runtime.close();

        return this.start(current.directory, options);
    }

    async recover(current: { runtime: ElectronRuntime; directory: string }, password: string) {
        const result = await current.runtime.send({
            type: 'recover',
            version: appVersion,
            dataDirectory: current.directory,
            password,
        });
        const restarted = await this.restart(current);

        return { ...restarted, recovery: result };
    }

    async teardown(): Promise<void> {
        const results = await Promise.allSettled(
            this.runtimes.splice(0).map((runtime) => runtime.close()),
        );

        for (const directory of this.directories) {
            await rm(directory, { recursive: true, force: true });
        }

        this.directories.clear();
        const errors = results.filter(
            (result): result is PromiseRejectedResult => result.status === 'rejected',
        );

        if (errors.length) {
            throw new AggregateError(
                errors.map((result) => result.reason),
                'Runtime cleanup failed',
            );
        }
    }
}

export class RuntimeSetup {
    static async availablePort(): Promise<number> {
        const listener = createServer();

        await new Promise<void>((resolve, reject) => {
            listener.once('error', reject);
            listener.listen(0, '127.0.0.1', resolve);
        });
        const port = (listener.address() as { port: number }).port;

        await new Promise<void>((resolve) => listener.close(() => resolve()));

        return port;
    }

    static async administrator(client: Client): Promise<void> {
        await client.prepare();
        const setup = await client.call(
            '/setup',
            'POST',
            { username: 'admin', password: 'administrator-new-password' },
            { headers: desktopWindow },
        );

        if (setup.status !== 201) {
            throw new Error('Administrator fixture setup failed: ' + setup.text);
        }
    }

    static async tlsConfiguration(client: Client): Promise<number> {
        const certificate = await generate([{ name: 'commonName', value: 'localhost' }], {
            keySize: 2048,
        });
        const occupied = createServer();

        await new Promise<void>((resolve) => occupied.listen(0, '127.0.0.1', resolve));
        const port = (occupied.address() as { port: number }).port;

        await new Promise<void>((resolve) => occupied.close(() => resolve()));
        const result = await client.call('/server-settings', 'PUT', {
            enabled: true,
            port,
            chain: certificate.cert,
            key: certificate.private,
        });

        if (result.status !== 200) {
            throw new Error('TLS fixture setup failed: ' + result.text);
        }

        return port;
    }
}
