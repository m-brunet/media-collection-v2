import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Server } from 'node:net';
import { createServer } from 'node:net';
import { networkInterfaces } from 'node:os';
import BetterSqlite3 from 'better-sqlite3';
import type { NoteDto, ServerStatus } from '../../packages/contracts/src/http.js';
import { Client } from './client.js';
import { administrator, availablePort, RuntimeFixture, tlsConfiguration } from './runtime-setup.js';

let fixture: RuntimeFixture;
let occupied: Server | undefined;

beforeEach(() => {
    fixture = new RuntimeFixture();
});
afterEach(async () => {
    try {
        await fixture.teardown();
    } finally {
        if (occupied?.listening) {
            await new Promise<void>((resolve) => occupied!.close(() => resolve()));
        }

        occupied = undefined;
    }
});

describe('Electron-managed runtime integration', () => {
    it('keeps serving the old HTTP port after saving a new preference', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        const port = await availablePort();

        const response = await current.client.call<ServerStatus>('/server-settings/http', 'PUT', {
            port,
        });

        expect(response.status).toBe(200);
        expect(response.body.configured.http.port).toBe(port);
        expect(response.body.running.httpPort).toBe(current.ready.httpPort);
        expect(response.body.restartRequired).toBe(true);
        expect((await fetch(current.client.base + '/api/health')).status).toBe(200);
        expect(await (await fetch(current.client.base)).text()).toContain('<div id="root">');
    });

    it('serves frontend pages and API on the saved HTTP port after restart', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        const port = await availablePort();

        await current.client.call('/server-settings/http', 'PUT', { port });

        const restarted = await fixture.restart(current, { port: null });
        const page = await fetch(restarted.client.base + '/notes');
        const health = await restarted.client.call('/health');

        expect(restarted.ready.httpPort).toBe(port);
        expect(page.status).toBe(200);
        expect(await page.text()).toContain('<div id="root">');
        expect(health.status).toBe(200);
        await expect(fetch(current.client.base + '/api/health')).rejects.toThrow();
    });

    it('reports active addresses and cleared pending state after applying the saved port', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        const port = await availablePort();

        await current.client.call('/server-settings/http', 'PUT', { port });
        const restarted = await fixture.restart(current, { port: null });

        await restarted.client.login('admin', 'administrator-new-password');

        const response = await restarted.client.call<ServerStatus>('/server-settings');

        expect(response.body.configured.http.port).toBe(port);
        expect(response.body.running.httpPort).toBe(port);
        expect(response.body.running.addresses).toContain('http://127.0.0.1:' + port);
        expect(response.body.running.httpPortOverride).toBeNull();
        expect(response.body.restartRequired).toBe(false);
    });

    it('reports the saved HTTP port and failure code when it is occupied', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        occupied = createServer();
        await new Promise<void>((resolve) => occupied!.listen(0, '0.0.0.0', resolve));
        const port = (occupied.address() as { port: number }).port;

        await current.client.call('/server-settings/http', 'PUT', { port });
        await current.runtime.close();
        const failed = fixture.launch(current.directory, { port: null });

        await expect(failed.ready).rejects.toThrow(
            'HTTP could not listen on port ' + port + ' (EADDRINUSE)',
        );
    });

    it('uses a temporary desktop override to recover an unavailable saved HTTP port', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        occupied = createServer();
        await new Promise<void>((resolve) => occupied!.listen(0, '0.0.0.0', resolve));
        const unavailablePort = (occupied.address() as { port: number }).port;

        await current.client.call('/server-settings/http', 'PUT', { port: unavailablePort });
        const overridePort = await availablePort();
        const correctedPort = await availablePort();
        const recovery = await fixture.restart(current, { main: true, port: overridePort });

        await recovery.client.login('admin', 'administrator-new-password');
        await recovery.client.call('/server-settings/http', 'PUT', { port: correctedPort });

        const restarted = await fixture.restart(recovery, { main: true, port: null });

        expect(restarted.ready.httpPort).toBe(correctedPort);
        expect((await restarted.client.call('/health')).status).toBe(200);
    });

    it('shows a CLI port override without replacing the stored preference', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        const savedPort = await availablePort();
        const cliPort = await availablePort();
        const environmentPort = await availablePort();

        await current.client.call('/server-settings/http', 'PUT', { port: savedPort });
        const restarted = await fixture.restart(current, {
            main: true,
            port: cliPort,
            environmentPort,
        });

        await restarted.client.login('admin', 'administrator-new-password');

        const response = await restarted.client.call<ServerStatus>('/server-settings');

        expect(restarted.ready.httpPort).toBe(cliPort);
        expect(response.body.configured.http.port).toBe(savedPort);
        expect(response.body.running.httpPortOverride).toEqual({
            port: cliPort,
            source: 'command-line',
        });
        expect(response.body.restartRequired).toBe(false);
    });

    it('uses an environment port override when the desktop has no CLI port', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        const savedPort = await availablePort();
        const environmentPort = await availablePort();

        await current.client.call('/server-settings/http', 'PUT', { port: savedPort });
        const restarted = await fixture.restart(current, {
            main: true,
            port: null,
            environmentPort,
        });

        await restarted.client.login('admin', 'administrator-new-password');

        const response = await restarted.client.call<ServerStatus>('/server-settings');

        expect(restarted.ready.httpPort).toBe(environmentPort);
        expect(response.body.configured.http.port).toBe(savedPort);
        expect(response.body.running.httpPortOverride).toEqual({
            port: environmentPort,
            source: 'environment',
        });
    });

    it('keeps HTTP available and shows a legacy privileged HTTPS port for correction', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        await tlsConfiguration(current.client);
        await current.runtime.close();
        const database = new BetterSqlite3(join(current.directory, 'application.sqlite'));
        const row = database
            .prepare("SELECT value FROM server_settings WHERE name = 'tls'")
            .get() as { value: string };
        const tls = JSON.parse(row.value);

        database
            .prepare("UPDATE server_settings SET value = ? WHERE name = 'tls'")
            .run(JSON.stringify({ ...tls, port: 443 }));
        database.close();
        const restarted = await fixture.start(current.directory);

        await restarted.client.login('admin', 'administrator-new-password');

        const response = await restarted.client.call<ServerStatus>('/server-settings');

        expect(restarted.ready.httpsPort).toBeNull();
        expect(restarted.ready.httpsError).toContain('1024');
        expect(response.status).toBe(200);
        expect(response.body.configured.tls.port).toBe(443);
        expect((await restarted.client.call('/health')).status).toBe(200);
    });

    it('preserves updated private Notes and sessions across restart', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        const created = await current.client.call<NoteDto>('/notes', 'POST', {
            title: 'Private note',
            body: 'Persisted',
        });

        await current.client.call('/notes/' + created.body.id, 'PATCH', {
            title: 'Updated',
            body: 'Changed',
        });
        const token = current.client.cookies.get('app_auth')!;

        const restarted = await fixture.restart(current);

        restarted.client.cookies.set('app_auth', token);
        const response = await restarted.client.call<NoteDto>('/notes/' + created.body.id);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: created.body.id,
            title: 'Updated',
            body: 'Changed',
        });
    });

    it('starts HTTP and HTTPS together from saved configuration', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        const httpsPort = await tlsConfiguration(current.client);

        const restarted = await fixture.restart(current);
        const http = await restarted.client.call('/health');
        const https = await new Client('https://127.0.0.1:' + httpsPort).call('/health');

        expect(restarted.ready.httpsPort).toBe(httpsPort);
        expect(http.status).toBe(200);
        expect(https.status).toBe(200);
    });

    it('uses secure cookies for HTTPS login without HSTS', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        const port = await tlsConfiguration(current.client);

        await fixture.restart(current);
        const client = new Client('https://127.0.0.1:' + port);

        await client.prepare();
        const input = { username: 'admin', password: 'administrator-new-password' };

        const response = await client.call('/auth/login', 'POST', input);

        expect(response.status).toBe(200);
        expect(response.headers['set-cookie']!.join(';')).toContain('__Secure-app_auth');
        expect(response.headers['set-cookie']!.join(';')).toContain('Secure');
        expect(response.headers['strict-transport-security']).toBeUndefined();
    });

    it('shares the same database across HTTP and HTTPS listeners', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        const port = await tlsConfiguration(current.client);
        const restarted = await fixture.restart(current);
        const secure = new Client('https://127.0.0.1:' + port);

        await secure.login('admin', 'administrator-new-password');
        const note = await secure.call<NoteDto>('/notes', 'POST', {
            title: 'Shared database',
            body: 'Both listeners',
        });

        await restarted.client.login('admin', 'administrator-new-password');

        const response = await restarted.client.call<NoteDto>('/notes/' + note.body.id);

        expect(response.status).toBe(200);
        expect(response.body.title).toBe('Shared database');
    });

    it('preserves HTTP availability when saved TLS material is broken', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        await tlsConfiguration(current.client);
        const token = current.client.cookies.get('app_auth')!;

        await current.runtime.close();
        const db = new BetterSqlite3(join(current.directory, 'application.sqlite'));
        const row = db.prepare("select value from server_settings where name = 'tls'").get() as {
            value: string;
        };

        db.close();
        const saved = JSON.parse(row.value) as { certificateDirectory: string };

        await writeFile(
            join(current.directory, 'tls', saved.certificateDirectory, 'key.pem'),
            'invalid private key',
        );

        const restarted = await fixture.start(current.directory);

        restarted.client.cookies.set('app_auth', token);
        const response = await restarted.client.call<ServerStatus>('/server-settings');
        const health = await restarted.client.call('/health');

        expect(restarted.ready.httpsPort).toBeNull();
        expect(restarted.ready.httpsError).toContain('HTTP is available');
        expect(response.body.running.httpsError).toContain('HTTPS could not start');
        expect(health.status).toBe(200);
    });

    it('reports an occupied HTTP port', async () => {
        occupied = createServer();
        await new Promise<void>((resolve) => occupied!.listen(0, '0.0.0.0', resolve));
        const port = (occupied.address() as { port: number }).port;

        const result = fixture.start(undefined, { port });

        await expect(result).rejects.toThrow(/EADDRINUSE|address already in use/i);
    });

    it('refuses recovery on missing storage without creating a database', async () => {
        const recovery = await fixture.start(undefined, { recovery: true });
        const command = {
            type: 'recover',
            dataDirectory: recovery.directory,
            login: 'admin',
            password: 'recovery-password',
        };

        const result = recovery.runtime.send(command);

        await expect(result).rejects.toThrow('No existing');
        await expect(readFile(join(recovery.directory, 'application.sqlite'))).rejects.toThrow();
    });

    it('invalidates existing sessions after offline recovery', async () => {
        const current = await fixture.start();

        await administrator(current.client);
        const token = current.client.cookies.get('app_auth')!;

        await current.runtime.close();
        const recovery = await fixture.start(current.directory, { recovery: true });

        const restarted = await fixture.recover(recovery, 'recovery-password');

        restarted.client.cookies.set('app_auth', token);
        const response = await restarted.client.call('/auth/me');

        expect(restarted.recovery.type).toBe('recovered');
        expect(response.status).toBe(401);
    });

    it('accepts the recovery password after administrator recovery', async () => {
        const password = 'recovery-password';
        const status = 200;
        const mustChangePassword = true;
        const current = await fixture.start();

        await administrator(current.client);
        await current.runtime.close();
        const recovery = await fixture.start(current.directory, { recovery: true });

        await recovery.runtime.send({
            type: 'recover',
            dataDirectory: current.directory,
            login: 'admin',
            password: 'recovery-password',
        });
        await recovery.runtime.close();
        const restarted = await fixture.start(current.directory);

        await restarted.client.prepare();
        const input = { username: 'admin', password };

        const response = await restarted.client.call('/auth/login', 'POST', input);

        expect(response.status).toBe(status);
        expect(response.body.mustChangePassword).toBe(mustChangePassword);
    });
    it('rejects the previous password after administrator recovery', async () => {
        const password = 'administrator-new-password';
        const status = 401;
        const mustChangePassword = undefined;
        const current = await fixture.start();

        await administrator(current.client);
        await current.runtime.close();
        const recovery = await fixture.start(current.directory, { recovery: true });

        await recovery.runtime.send({
            type: 'recover',
            dataDirectory: current.directory,
            login: 'admin',
            password: 'recovery-password',
        });
        await recovery.runtime.close();
        const restarted = await fixture.start(current.directory);

        await restarted.client.prepare();
        const input = { username: 'admin', password };

        const response = await restarted.client.call('/auth/login', 'POST', input);

        expect(response.status).toBe(status);
        expect(response.body.mustChangePassword).toBe(mustChangePassword);
    });

    const lan = Object.values(networkInterfaces())
        .flat()
        .find((entry) => entry && !entry.internal && entry.family === 'IPv4');

    it.skipIf(!lan)('accepts login over the LAN listener', async () => {
        const current = await fixture.start();
        const client = new Client('http://' + lan!.address + ':' + current.ready.httpPort);

        await client.prepare();
        const input = { username: 'admin', password: 'p@ssw0rd' };

        const response = await client.call('/auth/login', 'POST', input);

        expect(response.status).toBe(200);
    });
});
