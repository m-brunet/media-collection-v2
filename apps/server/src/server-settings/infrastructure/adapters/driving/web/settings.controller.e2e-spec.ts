import type { ServerStatus } from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { generate } from 'selfsigned';
import { HttpSettings } from '../../../../domain/value-objects/http-settings.value-object.js';
import { TlsSettings } from '../../../../domain/value-objects/tls-settings.value-object.js';
import { InternetAccess } from '../../../../domain/entities/internet-access.entity.js';
import { InternetAccessDoubles } from '../../../../application/testing/internet-access-doubles.test-support.js';

let app: TestApp;
const admin = new UserFixture({ username: 'administrator', role: 'admin' });
const member = new UserFixture({ username: 'member' });

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([admin, member]);
});
afterEach(async () => {
    await app?.teardown();
});
describe('GET /api/server-settings', () => {
    it('reports configured and running state without secrets', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect(response.status).toBe(200);
        expect(response.body.configured.tls).toEqual({
            enabled: false,
            port: 34443,
            hasCertificate: false,
        });
        expect(response.body.running.httpsPort).toBeNull();
        expect(response.body.configured.http).toEqual({ port: 34345 });
        expect(response.body.running.httpPortOverride).toBeNull();
        expect(response.body.restartRequired).toBe(false);
        expect(response.text).not.toContain('PRIVATE KEY');
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect(response.status).toBe(401);
    });
    it('rejects incomplete password setup', async () => {
        await app.requirePasswordReplacement(admin);
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect(response.status).toBe(403);
    });
    it('rejects non-administrators', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        expect(response.status).toBe(403);
    });
});
describe('PUT /api/server-settings', () => {
    it('saves valid TLS material with restart-required state', async () => {
        const client = await app.authenticatedClient(admin);
        const certificate = await generate([{ name: 'commonName', value: 'localhost' }], {
            keySize: 2048,
        });
        const input = {
            enabled: true,
            chain: certificate.cert,
            key: certificate.private,
        };

        const response = await client.call<ServerStatus>('/server-settings', 'PUT', input);

        expect(response.status).toBe(200);
        expect(response.body.configured.tls).toEqual({
            enabled: true,
            port: 34443,
            hasCertificate: true,
        });
        expect(response.body.restartRequired).toBe(true);
        expect(response.body.running.httpsPort).toBeNull();
        expect(response.text).not.toContain('PRIVATE KEY');
    });
    it('disables TLS without enabling a listener', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>('/server-settings', 'PUT', {
            enabled: false,
        });

        expect(response.status).toBe(200);
        expect(response.body.configured.tls.enabled).toBe(false);
        expect(response.body.configured.tls.port).toBe(34443);
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call<ServerStatus>('/server-settings', 'PUT', {
            enabled: false,
        });

        expect(response.status).toBe(401);
    });
    it('rejects incomplete password setup', async () => {
        await app.requirePasswordReplacement(admin);
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>('/server-settings', 'PUT', {
            enabled: false,
        });

        expect(response.status).toBe(403);
    });
    it('rejects non-administrators', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call<ServerStatus>('/server-settings', 'PUT', {
            enabled: false,
        });

        expect(response.status).toBe(403);
    });
    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>(
            '/server-settings',
            'PUT',
            { enabled: false },
            { csrf: false },
        );

        expect(response.status).toBe(403);
    });
    it('rejects enabling TLS without a certificate', async () => {
        const input = { enabled: true };
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>('/server-settings', 'PUT', input);

        expect(response.status).toBe(400);
        expect(await app.dependencies.tls.read()).toEqual({
            enabled: false,
            port: 34443,
            hasCertificate: false,
        });
    });
    it('rejects a port, now saved on its own', async () => {
        const input = { enabled: false, port: 36000 };
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>('/server-settings', 'PUT', input);

        expect(response.status).toBe(400);
        expect((await app.dependencies.tls.read()).port).toBe(34443);
    });
    it('rejects an invalid certificate pair', async () => {
        const input = { enabled: true, chain: 'broken', key: 'broken' };
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>('/server-settings', 'PUT', input);

        expect(response.status).toBe(400);
        expect(await app.dependencies.tls.read()).toEqual({
            enabled: false,
            port: 34443,
            hasCertificate: false,
        });
    });
    it('rejects an incomplete certificate pair', async () => {
        const input = { enabled: true, chain: 'broken' };
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>('/server-settings', 'PUT', input);

        expect(response.status).toBe(400);
        expect(await app.dependencies.tls.read()).toEqual({
            enabled: false,
            port: 34443,
            hasCertificate: false,
        });
    });
    it('rejects enabled HTTPS on the configured HTTP port', async () => {
        const client = await app.authenticatedClient(admin);
        const certificate = await generate([{ name: 'commonName', value: 'localhost' }], {
            keySize: 2048,
        });

        await app.dependencies.tls.save(
            new TlsSettings({ enabled: false, port: 34345, hasCertificate: false }),
        );

        const response = await client.call('/server-settings', 'PUT', {
            enabled: true,
            chain: certificate.cert,
            key: certificate.private,
        });

        expect(response.status).toBe(400);
        expect(response.text).toContain('different ports');
    });
});

describe('PUT /api/server-settings/http', () => {
    it('saves the external web port and reports a pending restart', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { port: 36000 };
        const runningPort = Number(new URL(client.base).port);

        const response = await client.call<ServerStatus>('/server-settings/http', 'PUT', input);

        expect(response.status).toBe(200);
        expect(response.body.configured.http).toEqual(input);
        expect(response.body.configured.tls).toEqual({
            enabled: false,
            port: 34443,
            hasCertificate: false,
        });
        expect(response.body.running.httpPort).toBe(runningPort);
        expect(response.body.restartRequired).toBe(true);
        expect((await app.dependencies.http.read()).snapshot()).toEqual(input);
    });

    it('accepts the inclusive minimum HTTP port', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { port: 1024 };

        const response = await client.call<ServerStatus>('/server-settings/http', 'PUT', input);

        expect(response.status).toBe(200);
        expect(response.body.configured.http).toEqual(input);
    });

    it('accepts the inclusive maximum HTTP port', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { port: 65535 };

        const response = await client.call<ServerStatus>('/server-settings/http', 'PUT', input);

        expect(response.status).toBe(200);
        expect(response.body.configured.http).toEqual(input);
    });

    it('does not request a restart when the saved HTTP port is unchanged', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { port: 34345 };

        const response = await client.call<ServerStatus>('/server-settings/http', 'PUT', input);

        expect(response.status).toBe(200);
        expect(response.body.restartRequired).toBe(false);
    });

    it('clears the HTTP pending change when reverting to the startup preference', async () => {
        const client = await app.authenticatedClient(admin);

        await app.dependencies.http.save(new HttpSettings(36000));

        const response = await client.call<ServerStatus>('/server-settings/http', 'PUT', {
            port: 34345,
        });

        expect(response.status).toBe(200);
        expect(response.body.restartRequired).toBe(false);
    });

    it('retains a pending TLS change when saving an unchanged HTTP preference', async () => {
        const client = await app.authenticatedClient(admin);

        await app.dependencies.tls.save(
            new TlsSettings({ enabled: false, port: 4000, hasCertificate: false }),
        );

        const response = await client.call<ServerStatus>('/server-settings/http', 'PUT', {
            port: 34345,
        });

        expect(response.status).toBe(200);
        expect(response.body.configured.tls.port).toBe(4000);
        expect(response.body.restartRequired).toBe(true);
    });

    it('rejects a port below the minimum without changing storage', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { port: 1023 };

        const response = await client.call('/server-settings/http', 'PUT', input);

        expect(response.status).toBe(400);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects a port above the maximum without changing storage', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { port: 65536 };

        const response = await client.call('/server-settings/http', 'PUT', input);

        expect(response.status).toBe(400);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects port zero', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { port: 0 };

        const response = await client.call('/server-settings/http', 'PUT', input);

        expect(response.status).toBe(400);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects a negative port', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { port: -1 };

        const response = await client.call('/server-settings/http', 'PUT', input);

        expect(response.status).toBe(400);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects a fractional port', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { port: 36000.5 };

        const response = await client.call('/server-settings/http', 'PUT', input);

        expect(response.status).toBe(400);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects a numeric string instead of a number', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { port: '36000' };

        const response = await client.call('/server-settings/http', 'PUT', input);

        expect(response.status).toBe(400);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects a missing port', async () => {
        const client = await app.authenticatedClient(admin);
        const input = {};

        const response = await client.call('/server-settings/http', 'PUT', input);

        expect(response.status).toBe(400);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects fields outside the HTTP port contract', async () => {
        const client = await app.authenticatedClient(admin);
        const input = { port: 36000, host: '127.0.0.1' };

        const response = await client.call('/server-settings/http', 'PUT', input);

        expect(response.status).toBe(400);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects unauthenticated changes', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/server-settings/http', 'PUT', { port: 36000 });

        expect(response.status).toBe(401);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects non-administrators', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/server-settings/http', 'PUT', { port: 36000 });

        expect(response.status).toBe(403);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects changes before password setup', async () => {
        await app.requirePasswordReplacement(admin);
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/http', 'PUT', { port: 36000 });

        expect(response.status).toBe(403);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call(
            '/server-settings/http',
            'PUT',
            { port: 36000 },
            { csrf: false },
        );

        expect(response.status).toBe(403);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects an untrusted request origin', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call(
            '/server-settings/http',
            'PUT',
            { port: 36000 },
            { origin: 'https://other.example' },
        );

        expect(response.status).toBe(403);
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });

    it('rejects a port used by configured enabled HTTPS', async () => {
        const client = await app.authenticatedClient(admin);
        const certificate = await generate([{ name: 'commonName', value: 'localhost' }], {
            keySize: 2048,
        });

        await app.dependencies.tls.save(
            new TlsSettings({ enabled: true, port: 36000, hasCertificate: true }),
            { chain: certificate.cert, key: certificate.private },
        );

        const response = await client.call('/server-settings/http', 'PUT', { port: 36000 });

        expect(response.status).toBe(400);
        expect(response.text).toContain('different ports');
        expect((await app.dependencies.http.read()).snapshot()).toEqual({ port: 34345 });
    });
});

describe('PUT /api/server-settings/https-port', () => {
    it('saves the HTTPS port and reports a pending restart', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>('/server-settings/https-port', 'PUT', {
            port: 36000,
        });

        expect(response.status).toBe(200);
        expect(response.body.configured.tls).toEqual({
            enabled: false,
            port: 36000,
            hasCertificate: false,
        });
        expect(response.body.restartRequired).toBe(true);
    });

    it('saves the HTTPS port while internet access is on', async () => {
        const client = await app.authenticatedClient(admin);

        await app.dependencies.internetAccess.store.save(
            new InternetAccess(InternetAccessDoubles.active({ routerPort: 34443 })),
        );

        const response = await client.call<ServerStatus>('/server-settings/https-port', 'PUT', {
            port: 36000,
        });

        expect([response.status, response.body.configured.tls.port]).toEqual([200, 36000]);
    });

    it('keeps the certificate settings', async () => {
        const client = await app.authenticatedClient(admin);
        const certificate = await generate([{ name: 'commonName', value: 'localhost' }], {
            keySize: 2048,
        });

        await app.dependencies.tls.save(
            new TlsSettings({ enabled: true, port: 34443, hasCertificate: true }),
            { chain: certificate.cert, key: certificate.private },
        );

        const response = await client.call<ServerStatus>('/server-settings/https-port', 'PUT', {
            port: 36000,
        });

        expect(response.body.configured.tls).toEqual({
            enabled: true,
            port: 36000,
            hasCertificate: true,
        });
    });

    it('accepts the inclusive minimum HTTPS port', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>('/server-settings/https-port', 'PUT', {
            port: 1024,
        });

        expect([response.status, response.body.configured.tls.port]).toEqual([200, 1024]);
    });

    it('accepts the inclusive maximum HTTPS port', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<ServerStatus>('/server-settings/https-port', 'PUT', {
            port: 65535,
        });

        expect([response.status, response.body.configured.tls.port]).toEqual([200, 65535]);
    });

    it('rejects port 443', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/https-port', 'PUT', { port: 443 });

        expect(response.status).toBe(400);
        expect((await app.dependencies.tls.read()).port).toBe(34443);
    });

    it('rejects a port above the maximum', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/https-port', 'PUT', { port: 65536 });

        expect(response.status).toBe(400);
        expect((await app.dependencies.tls.read()).port).toBe(34443);
    });

    it('rejects a fractional port', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/https-port', 'PUT', {
            port: 36000.5,
        });

        expect(response.status).toBe(400);
        expect((await app.dependencies.tls.read()).port).toBe(34443);
    });

    it('rejects fields outside the HTTPS port contract', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/https-port', 'PUT', {
            port: 36000,
            enabled: true,
        });

        expect(response.status).toBe(400);
        expect((await app.dependencies.tls.read()).port).toBe(34443);
    });

    it('rejects the HTTP port', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call('/server-settings/https-port', 'PUT', { port: 34345 });

        expect(response.status).toBe(400);
        expect(response.text).toContain('different ports');
        expect((await app.dependencies.tls.read()).port).toBe(34443);
    });

    it('rejects unauthenticated changes', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/server-settings/https-port', 'PUT', { port: 36000 });

        expect(response.status).toBe(401);
    });

    it('rejects non-administrators', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/server-settings/https-port', 'PUT', { port: 36000 });

        expect(response.status).toBe(403);
        expect((await app.dependencies.tls.read()).port).toBe(34443);
    });

    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call(
            '/server-settings/https-port',
            'PUT',
            { port: 36000 },
            { csrf: false },
        );

        expect(response.status).toBe(403);
        expect((await app.dependencies.tls.read()).port).toBe(34443);
    });
});
