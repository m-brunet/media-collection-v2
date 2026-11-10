import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrivateStorage } from '../../../../../shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';
import { AcmeAccountKey } from '../filesystem/acme-account-key.adapter.js';
import { TlsAlpnChallenges } from '../security/tls-alpn-challenges.adapter.js';
import { AcmeCertificateAuthority } from './acme-certificate-authority.adapter.js';
import { AcmeConnector } from './acme-session.adapter.js';

const servers: Server[] = [];
const directories: string[] = [];

afterEach(async () => {
    await Promise.all(
        servers.splice(0).map(
            (server) =>
                new Promise<void>((resolve) => {
                    server.closeAllConnections();
                    server.close(() => resolve());
                }),
        ),
    );
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function letsEncryptWith(account: (response: ServerResponse) => void) {
    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
        const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;

        if (request.url === '/directory') {
            response.setHeader('content-type', 'application/json');
            response.end(
                JSON.stringify({
                    newNonce: base + '/nonce',
                    newAccount: base + '/account',
                    newOrder: base + '/order',
                }),
            );
        } else if (request.url === '/nonce') {
            response.setHeader('replay-nonce', 'nonce');
            response.end();
        } else {
            request.resume();
            account(response);
        }
    });

    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    return 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/directory';
}

async function authorityFor(directoryUrl: string, requestTimeoutMs?: number) {
    const directory = await mkdtemp(join(tmpdir(), 'acme-session-'));

    directories.push(directory);

    return new AcmeCertificateAuthority(
        new AcmeConnector(directoryUrl, requestTimeoutMs),
        new AcmeAccountKey(directory, new PrivateStorage()),
        new TlsAlpnChallenges(),
    );
}

it('reports a Let’s Encrypt limit at once instead of waiting for its Retry-After', async () => {
    const authority = await authorityFor(
        await letsEncryptWith((response) => {
            response.statusCode = 429;
            response.setHeader('retry-after', '86400');
            response.setHeader('content-type', 'application/problem+json');
            response.end(
                JSON.stringify({
                    type: 'urn:ietf:params:acme:error:rateLimited',
                    detail: 'too many certificates (5) already issued for this exact set of identifiers',
                }),
            );
        }),
    );

    const issue = await authority.issue({ kind: 'address', name: '82.66.118.204' });

    expect(issue).toEqual({ outcome: 'refused', reason: 'rate-limited' });
});
it('gives up on a Let’s Encrypt request that does not answer', async () => {
    const authority = await authorityFor(await letsEncryptWith(() => undefined), 200);

    const issue = await authority.issue({ kind: 'address', name: '82.66.118.204' });

    expect(issue).toEqual({ outcome: 'refused', reason: 'authority-unavailable' });
});
