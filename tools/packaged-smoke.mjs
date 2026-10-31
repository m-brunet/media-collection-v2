import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { closeDesktop } from './processes.mjs';

const executable = resolve(
    process.env.APP_PACKAGED_EXECUTABLE ??
    (process.platform === 'win32'
        ? 'release/win-unpacked/Electron Base.exe'
        : process.platform === 'darwin'
            ? 'release/mac/Electron Base.app/Contents/MacOS/Electron Base'
            : 'release/linux-unpacked/electron-base'),
);

await access(executable);
const directory = await mkdtemp(join(tmpdir(), 'electron-packaged-'));
const portReservation = createServer();

await new Promise((resolve) => portReservation.listen(0, '127.0.0.1', resolve));
const port = portReservation.address().port;

await new Promise((resolve) => portReservation.close(resolve));
let base = 'http://127.0.0.1:' + port;
let child;
let failureOutput = '';
const launch = async (withPortOverride = true) => {
    const environment = { ...process.env };

    delete environment.APP_DEV_UI;
    delete environment.ELECTRON_RUN_AS_NODE;
    delete environment.APP_HTTP_PORT;
    delete environment.APP_HOST;
    delete environment.APP_DATA_DIR;
    child = spawn(
        executable,
        [...(withPortOverride ? ['--http-port', String(port)] : []), '--data-dir', directory],
        {
            cwd: directory,
            env: environment,
            stdio: ['ignore', 'pipe', 'pipe']
        }
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
        body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
    });

    for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0];
        const separator = pair.indexOf('=');

        cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }

    assert.ok(
        response.ok,
        method + ' ' + path + ' failed: ' + response.status + ' ' + (await response.clone().text())
    );

    return response.status === 204 ? undefined : response.json();
}

try {
    await launch();
    const page = await fetch(base);

    assert.equal(page.status, 200);
    assert.match(await page.text(), /<div id="root">/);
    csrf = (await request('/auth/csrf')).token;
    await request('/auth/login', 'POST', { username: 'admin', password: 'p@ssw0rd' });
    await request('/account/password', 'PATCH', {
        currentPassword: 'p@ssw0rd',
        password: 'packaged-smoke-password'
    });
    const note = await request('/notes', 'POST', {
        title: 'Packaged persistence',
        body: 'Native SQLite works outside the checkout.'
    });
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
    assert.match(await (await fetch(base + '/notes')).text(), /<div id="root">/);
    await assert.rejects(fetch(previousBase + '/api/health'));
    assert.equal(
        (await request('/notes/' + note.id)).body,
        'Native SQLite works outside the checkout.'
    );
    await request('/notes/' + note.id, 'DELETE');
    console.log(
        'Packaged Electron smoke passed: saved web listening port, HTTP, web assets, native SQLite, graceful close, restart and persistence.'
    );
} finally {
    if (child) {
        await closeDesktop(child);
    }

    // Only the unique directory returned by mkdtemp is removed.
    await rm(directory, { recursive: true, force: true });
}
