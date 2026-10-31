import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { build, createServer } from 'vite';
import { closeDesktop, run } from './processes.mjs';

const electron = createRequire(import.meta.url)('electron');
const typescript = JSON.parse(readFileSync('node_modules/typescript/package.json', 'utf8'));
const compiler = resolve('node_modules/typescript', typescript.bin.tsc);

await run(process.execPath, [compiler, '-p', 'tsconfig.runtime.json']);
await build({ configFile: resolve('vite.config.ts') });
let apiProxy;
const vite = await createServer({
    configFile: resolve('vite.config.ts'),
    server: {
        proxy: {
            '/api': {
                configure(proxy) {
                    apiProxy = proxy;
                }
            }
        }
    }
});

await vite.listen();
vite.printUrls();
const environment = { ...process.env, APP_DEV_UI: vite.resolvedUrls.local[0] };

delete environment.ELECTRON_RUN_AS_NODE;
let desktop;
let closing = false;
let restarting = false;
let changedAgain = false;
const launch = () => {
    desktop = spawn(electron, ['.'], { stdio: ['inherit', 'pipe', 'inherit'], env: environment });
    createInterface({ input: desktop.stdout }).on('line', (line) => {
        console.log(line);
        const match = /^Application backend ready on HTTP port (\d+)$/.exec(line);

        if (match && apiProxy) {
            apiProxy.options.target = 'http://127.0.0.1:' + match[1];
        }
    });
    desktop.once('error', (error) => {
        console.error(error.message);
        void shutdown();
    });
    desktop.once('exit', () => {
        if (!restarting && !closing) {
            void shutdown();
        }
    });
};

launch();
const compilerWatch = spawn(
    process.execPath,
    [
        compiler,
        '-p',
        'tsconfig.runtime.json',
        '--watch',
        '--preserveWatchOutput',
        '--pretty',
        'false'
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] }
);
let firstCompilation = true;
let compilerOutput = '';
const successfulCompilation = 'Found 0 errors. Watching for file changes.';

compilerWatch.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    compilerOutput = (compilerOutput + String(chunk)).slice(-16000);
    const index = compilerOutput.indexOf(successfulCompilation);

    if (index < 0) {
        return;
    }

    compilerOutput = compilerOutput.slice(index + successfulCompilation.length);

    if (firstCompilation) {
        firstCompilation = false;
    } else {
        void restart();
    }
});
compilerWatch.once('error', (error) => {
    console.error(error.message);
    void shutdown();
});
compilerWatch.once('exit', () => {
    if (!closing) {
        console.error('The TypeScript watcher stopped.');
        void shutdown();
    }
});

async function restart() {
    if (closing) {
        return;
    }

    if (restarting) {
        changedAgain = true;

        return;
    }

    restarting = true;

    try {
        await closeDesktop(desktop);

        if (!closing) {
            launch();
        }
    } finally {
        restarting = false;

        if (changedAgain) {
            changedAgain = false;
            void restart();
        }
    }
}

async function shutdown() {
    if (closing) {
        return;
    }

    closing = true;
    compilerWatch.kill();
    await closeDesktop(desktop);
    await vite.close();
}

process.on('SIGINT', () => {
    void shutdown();
});
process.on('SIGTERM', () => {
    void shutdown();
});
