import { afterEach, expect, it } from 'vitest';
import { X509Certificate } from 'node:crypto';
import { createServer } from 'node:net';
import { connect } from 'node:tls';
import { generate } from 'selfsigned';
import { TlsAlpnChallenges } from '../security/tls-alpn-challenges.adapter.js';
import { NodeHttpsRuntime } from './node-https-runtime.adapter.js';

const runtimes: NodeHttpsRuntime[] = [];

afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
});

async function certificate(commonName: string) {
    const generated = await generate([{ name: 'commonName', value: commonName }], {
        keySize: 2048,
    });

    return { chain: generated.cert, key: generated.private };
}

function runtime(challenges = new TlsAlpnChallenges()) {
    const created = new NodeHttpsRuntime(
        (_request, response) => response.end('ok'),
        '127.0.0.1',
        challenges,
    );

    runtimes.push(created);

    return created;
}

async function freePort(): Promise<number> {
    const server = createServer();

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;

    await new Promise<void>((resolve) => server.close(() => resolve()));

    return port;
}

// Opens a TLS connection like a browser (no server name for an IP, HTTP/1.1) or like
// Let's Encrypt (reverse-DNS server name, `acme-tls/1`) and reports what the server answered.
function handshake(port: number, options: { servername?: string; protocols: string[] }) {
    return new Promise<{ subject: string | null; protocol: string | false | null }>(
        (resolve, reject) => {
            const socket = connect({
                host: '127.0.0.1',
                port,
                servername: options.servername,
                ALPNProtocols: options.protocols,
                rejectUnauthorized: false,
            });

            socket.once('secureConnect', () => {
                const raw = socket.getPeerX509Certificate();

                resolve({
                    subject: raw ? new X509Certificate(raw.raw).subject : null,
                    protocol: socket.alpnProtocol,
                });
                socket.destroy();
            });
            socket.once('error', reject);
        },
    );
}

it('serves the saved certificate to browsers over HTTP/1.1', async () => {
    const subject = runtime();
    const port = await subject.start(await freePort(), await certificate('saved'));

    const answer = await handshake(port, { protocols: ['h2', 'http/1.1'] });

    expect(answer).toEqual({ subject: 'CN=saved', protocol: 'http/1.1' });
});
it('swaps the certificate without stopping the listener', async () => {
    const subject = runtime();
    const port = await subject.start(await freePort(), await certificate('old'));

    await subject.install(port, await certificate('renewed'));

    expect(await handshake(port, { protocols: ['http/1.1'] })).toEqual({
        subject: 'CN=renewed',
        protocol: 'http/1.1',
    });
});
it('answers Let’s Encrypt with the waiting challenge certificate', async () => {
    const challenges = new TlsAlpnChallenges();
    const subject = runtime(challenges);
    const port = await subject.start(await freePort(), await certificate('saved'));
    const challenge = await certificate('challenge');

    challenges.add('82.66.118.204', { cert: challenge.chain, key: challenge.key });

    const answer = await handshake(port, {
        servername: '204.118.66.82.in-addr.arpa',
        protocols: ['acme-tls/1'],
    });

    expect(answer).toEqual({ subject: 'CN=challenge', protocol: 'acme-tls/1' });
});
it('refuses acme-tls/1 when no challenge waits', async () => {
    const subject = runtime();
    const port = await subject.start(await freePort(), await certificate('saved'));

    const answer = handshake(port, {
        servername: '204.118.66.82.in-addr.arpa',
        protocols: ['acme-tls/1'],
    });

    await expect(answer).rejects.toThrow();
});
it('starts without a certificate so that Let’s Encrypt can check the port', async () => {
    const challenges = new TlsAlpnChallenges();
    const subject = runtime(challenges);
    const challenge = await certificate('challenge');
    const port = await freePort();

    challenges.add('82.66.118.204', { cert: challenge.chain, key: challenge.key });

    await subject.ensureRunning(port);

    expect(
        await handshake(port, {
            servername: '204.118.66.82.in-addr.arpa',
            protocols: ['acme-tls/1'],
        }),
    ).toEqual({ subject: 'CN=challenge', protocol: 'acme-tls/1' });
});
it('gives browsers no page before the first certificate', async () => {
    const subject = runtime();
    const port = await freePort();

    await subject.ensureRunning(port);

    const answer = handshake(port, { protocols: ['http/1.1'] });

    await expect(answer).rejects.toThrow();
});
it('reports a port that is already taken', async () => {
    const occupied = runtime();
    const port = await occupied.start(await freePort(), await certificate('other'));
    const subject = runtime();

    const running = await subject.ensureRunning(port);

    expect(running).toBe(false);
});
it('starts the listener when the first certificate is installed', async () => {
    const subject = runtime();
    const port = await freePort();

    await subject.install(port, await certificate('first'));

    expect(await handshake(port, { protocols: ['http/1.1'] })).toEqual({
        subject: 'CN=first',
        protocol: 'http/1.1',
    });
});
