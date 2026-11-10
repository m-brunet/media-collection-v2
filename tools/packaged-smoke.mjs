import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { closeDesktop } from './processes.mjs';

const executable = resolve(
    process.env.APP_PACKAGED_EXECUTABLE ??
        (process.platform === 'win32'
            ? 'release/win-unpacked/Media Collection.exe'
            : process.platform === 'darwin'
              ? 'release/mac/Media Collection.app/Contents/MacOS/Media Collection'
              : 'release/linux-unpacked/media-collection'),
);

await access(executable);
const directory = await mkdtemp(join(tmpdir(), 'electron-packaged-'));
const portReservation = createServer();

await new Promise((resolve) => portReservation.listen(0, '127.0.0.1', resolve));
const port = portReservation.address().port;

await new Promise((resolve) => portReservation.close(resolve));
const debugReservation = createServer();

await new Promise((resolve) => debugReservation.listen(0, '127.0.0.1', resolve));
// First-launch setup only works inside the app window, so the smoke test drives that window
// through Chromium's debugging port during the first launch.
const debugPort = debugReservation.address().port;

await new Promise((resolve) => debugReservation.close(resolve));
let base = 'http://127.0.0.1:' + port;
let child;
let failureOutput = '';
const launch = async (withPortOverride = true, debugging = false) => {
    // Internet access stays offline: the smoke test never reaches a router or Let's Encrypt.
    const environment = {
        ...process.env,
        APP_HIDDEN_WINDOWS: '1',
        APP_OFFLINE_INTERNET_ACCESS: '1',
    };

    delete environment.APP_DEV_UI;
    delete environment.ELECTRON_RUN_AS_NODE;
    delete environment.APP_HTTP_PORT;
    delete environment.APP_HOST;
    delete environment.APP_DATA_DIR;
    child = spawn(
        executable,
        [
            ...(withPortOverride ? ['--http-port', String(port)] : []),
            ...(debugging ? ['--remote-debugging-port=' + debugPort] : []),
            '--data-dir',
            directory,
        ],
        {
            cwd: directory,
            env: environment,
            stdio: ['ignore', 'pipe', 'pipe'],
        },
    );
    child.on('error', (error) => {
        failureOutput += error.message;
    });
    child.stderr.on('data', (data) => {
        failureOutput = (failureOutput + data).slice(-8000);
    });

    for (let attempt = 0; attempt < 150; attempt++) {
        if (child.exitCode !== null) {
            throw new Error('Packaged app exited: ' + failureOutput);
        }

        try {
            if ((await fetch(base + '/api/health')).ok) {
                await delay(800);

                return;
            }
        } catch {}

        await delay(200);
    }

    throw new Error('Packaged app did not become ready: ' + failureOutput);
};
const cookies = new Map();
let csrf;

async function request(path, method = 'GET', body) {
    const response = await fetch(base + '/api' + path, {
        method,
        headers: {
            Cookie: [...cookies].map(([key, value]) => key + '=' + value).join('; '),
            ...(method !== 'GET'
                ? { 'Content-Type': 'application/json', Origin: base, 'X-CSRF-Token': csrf }
                : {}),
        },
        body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });

    for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0];
        const separator = pair.indexOf('=');

        cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }

    assert.ok(
        response.ok,
        method + ' ' + path + ' failed: ' + response.status + ' ' + (await response.clone().text()),
    );

    return response.status === 204 ? undefined : response.json();
}

async function setUpInWindow() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:' + debugPort);

    try {
        const [page] = browser.contexts()[0].pages();
        const status = await page.evaluate(async () => {
            const token = (await (await fetch('/api/auth/csrf')).json()).token;
            const response = await fetch('/api/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
                body: JSON.stringify({ username: 'admin', password: 'packaged-smoke-password' }),
            });

            return response.status;
        });

        assert.equal(status, 201);
    } finally {
        await browser.close();
    }
}

try {
    await launch(true, true);
    const page = await fetch(base);

    assert.equal(page.status, 200);
    assert.match(await page.text(), /<div id="root">/);
    csrf = (await request('/auth/csrf')).token;
    assert.equal((await request('/setup')).required, true);
    await assert.rejects(
        request('/setup', 'POST', { username: 'admin', password: 'packaged-smoke-password' }),
        /403/,
    );
    await setUpInWindow();
    await request('/auth/login', 'POST', {
        username: 'admin',
        password: 'packaged-smoke-password',
    });
    await request('/account/language', 'PATCH', { language: 'fr' });
    const nextReservation = createServer();

    await new Promise((resolve) => nextReservation.listen(0, '127.0.0.1', resolve));
    const nextPort = nextReservation.address().port;

    await new Promise((resolve) => nextReservation.close(resolve));
    const saved = await request('/server-settings/http', 'PUT', { port: nextPort });

    assert.equal(saved.configured.http.port, nextPort);
    assert.equal(saved.running.httpPort, port);
    assert.equal(saved.restartRequired, true);
    const previousBase = base;

    await closeDesktop(child);
    base = 'http://127.0.0.1:' + nextPort;
    await launch(false);
    const applied = await request('/server-settings');

    assert.equal(applied.configured.http.port, nextPort);
    assert.equal(applied.running.httpPort, nextPort);
    assert.equal(applied.running.httpPortOverride, null);
    assert.equal(applied.restartRequired, false);
    assert.match(await (await fetch(base + '/account')).text(), /<div id="root">/);
    assert.match(await (await fetch(base + '/leaf/')).text(), /<div id="root">/);
    await assert.rejects(fetch(previousBase + '/api/health'));
    assert.equal((await request('/auth/me')).language, 'fr');
    console.log(
        'Packaged Electron smoke passed: saved web listening port, HTTP, web assets, native SQLite, graceful close, restart and persistence.',
    );
} finally {
    if (child) {
        await closeDesktop(child);
    }

    // Only the unique directory returned by mkdtemp is removed. On Windows the backend process
    // can hold it (its working directory) for a moment after the window closed, so retry briefly.
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
}
