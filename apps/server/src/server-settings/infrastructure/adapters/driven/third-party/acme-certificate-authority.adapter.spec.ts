import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from 'selfsigned';
import { AuthorityKeyIdentifierExtension, X509CertificateGenerator } from '@peculiar/x509';
import { PrivateStorage } from '../../../../../shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';
import { AcmeAccountKey } from '../filesystem/acme-account-key.adapter.js';
import { TlsAlpnChallenges } from '../security/tls-alpn-challenges.adapter.js';
import { AcmeCertificateAuthority } from './acme-certificate-authority.adapter.js';
import type { AcmeSession } from './acme-session.adapter.js';
import { AcmeConnector } from './acme-session.adapter.js';

const address = '82.66.118.204';
const ip = { kind: 'address', name: address } as const;
const domain = { kind: 'domain', name: 'home.example.fr' } as const;
const directories: string[] = [];

afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

const algorithm = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };

// The certificate being renewed, with the RFC 9773 example key identifier and serial number: its
// ARI identifier is "aYhba4dGQEHhs3uEe6CuLN4ByNQ.AIdlQyE".
async function currentChain(keyId: string | null = '69885b6b87464041e1b37b847ba0ae2cde01c8d4') {
    const keys = await crypto.subtle.generateKey(algorithm, false, ['sign', 'verify']);
    const certificate = await X509CertificateGenerator.createSelfSigned({
        serialNumber: '0087654321',
        name: 'CN=' + address,
        notBefore: new Date('2026-11-08T10:00:00Z'),
        notAfter: new Date('2026-11-15T02:00:00Z'),
        keys,
        signingAlgorithm: algorithm,
        extensions: keyId ? [new AuthorityKeyIdentifierExtension(keyId)] : [],
    });

    return certificate.toString('pem');
}

class ScriptedSession {
    readonly orders: unknown[] = [];
    readonly requested: unknown[] = [];
    challengeWaiting = false;
    orderFailure: Error | null = null;
    replacesFailure: Error | null = null;
    validationFailure: Error | null = null;
    challengeTypes = ['http-01', 'tls-alpn-01'];

    constructor(
        private readonly challenges: TlsAlpnChallenges,
        private readonly chain: string,
    ) {}

    async createAccount() {
        return {};
    }

    async createOrder(order: { replaces?: string }) {
        this.requested.push(order);

        if (this.orderFailure) {
            throw this.orderFailure;
        }

        if (order.replaces && this.replacesFailure) {
            throw this.replacesFailure;
        }

        this.orders.push(order);

        return { url: 'order' };
    }

    async getAuthorizations() {
        const order = this.orders.at(-1) as { identifiers: { type: string; value: string }[] };

        return [
            {
                identifier: order.identifiers[0],
                challenges: this.challengeTypes.map((type) => ({ type, url: type, token: 't' })),
            },
        ];
    }

    async getChallengeKeyAuthorization() {
        return 'key-authorization';
    }

    async completeChallenge() {
        this.challengeWaiting =
            this.challenges.contextFor(TlsAlpnChallenges.serverName(ip)) !== undefined ||
            this.challenges.contextFor(TlsAlpnChallenges.serverName(domain)) !== undefined;
    }

    async waitForValidStatus() {
        if (this.validationFailure) {
            throw this.validationFailure;
        }
    }

    async finalizeOrder() {
        return { certificate: 'certificate' };
    }

    async getCertificate() {
        return this.chain;
    }
}

class ScriptedConnector extends AcmeConnector {
    constructor(private readonly session: ScriptedSession) {
        super('https://acme.invalid/directory');
    }

    open(): AcmeSession {
        return this.session as unknown as AcmeSession;
    }
}

async function authorityWith() {
    const directory = await mkdtemp(join(tmpdir(), 'acme-'));
    const challenges = new TlsAlpnChallenges();
    const issued = await generate([{ name: 'commonName', value: address }], { keySize: 2048 });
    const session = new ScriptedSession(challenges, issued.cert);
    const logs: string[] = [];
    const authority = new AcmeCertificateAuthority(
        new ScriptedConnector(session),
        new AcmeAccountKey(directory, new PrivateStorage()),
        challenges,
        (line) => logs.push(line),
    );

    directories.push(directory);

    return { authority, session, challenges, logs };
}

it('issues a short-lived certificate for the public IP address', async () => {
    const { authority, session } = await authorityWith();

    const issue = await authority.issue(ip, null);

    expect([issue.outcome, session.orders]).toEqual([
        'issued',
        [{ identifiers: [{ type: 'ip', value: address }], profile: 'shortlived' }],
    ]);
});
it('gives the new private key with the certificate', async () => {
    const { authority } = await authorityWith();

    const issue = await authority.issue(ip, null);

    expect(issue.outcome === 'issued' && issue.certificate.key).toContain('PRIVATE KEY');
});
it('offers the challenge answer while Let’s Encrypt checks, then withdraws it', async () => {
    const { authority, session, challenges } = await authorityWith();

    await authority.issue(ip, null);

    expect([
        session.challengeWaiting,
        challenges.contextFor(TlsAlpnChallenges.serverName(ip)),
    ]).toEqual([true, undefined]);
});
it('reports an unreachable port when the check fails', async () => {
    const { authority, session } = await authorityWith();

    session.validationFailure = new Error('Timeout after connect (your server may be slow)');

    const issue = await authority.issue(ip, null);

    expect(issue).toEqual({ outcome: 'refused', reason: 'not-reachable' });
});
it('reports Let’s Encrypt limits', async () => {
    const { authority, session } = await authorityWith();

    session.orderFailure = new Error('too many certificates (5) already issued for this exact set');

    const issue = await authority.issue(ip, null);

    expect(issue).toEqual({ outcome: 'refused', reason: 'rate-limited', retryAfter: null });
});
it('reads the date Let’s Encrypt gives with a limit', async () => {
    const { authority, session } = await authorityWith();

    session.orderFailure = new Error(
        'too many failed authorizations (5) for "82.66.118.204" in the last 1h0m0s, retry after 2026-11-10 12:12:00 UTC: see https://letsencrypt.org/docs/rate-limits/',
    );

    const issue = await authority.issue(ip, null);

    expect(issue).toEqual({
        outcome: 'refused',
        reason: 'rate-limited',
        retryAfter: '2026-11-10T12:12:00.000Z',
    });
});
it('reports Let’s Encrypt as unavailable on any other error', async () => {
    const { authority, session } = await authorityWith();

    session.orderFailure = new Error('getaddrinfo ENOTFOUND acme-v02.api.letsencrypt.org');

    const issue = await authority.issue(ip, null);

    expect(issue).toEqual({ outcome: 'refused', reason: 'authority-unavailable' });
});
it('reports Let’s Encrypt as unavailable without a TLS-ALPN-01 challenge', async () => {
    const { authority, session } = await authorityWith();

    session.challengeTypes = ['http-01'];

    const issue = await authority.issue(ip, null);

    expect(issue).toEqual({ outcome: 'refused', reason: 'authority-unavailable' });
});
it('issues a classic certificate for a domain name', async () => {
    const { authority, session } = await authorityWith();

    const issue = await authority.issue(domain, null);

    expect([issue.outcome, session.orders]).toEqual([
        'issued',
        [{ identifiers: [{ type: 'dns', value: 'home.example.fr' }], profile: 'classic' }],
    ]);
});
it('offers the domain challenge answer under the domain name, then withdraws it', async () => {
    const { authority, session, challenges } = await authorityWith();

    await authority.issue(domain, null);

    expect([session.challengeWaiting, challenges.contextFor('home.example.fr')]).toEqual([
        true,
        undefined,
    ]);
});
it('orders a new certificate without naming one it replaces', async () => {
    const { authority, session } = await authorityWith();

    const issue = await authority.issue(ip, null);

    expect([issue.outcome === 'issued' && issue.renewal, session.requested]).toEqual([
        false,
        [{ identifiers: [{ type: 'ip', value: address }], profile: 'shortlived' }],
    ]);
});
it('renews through ARI, naming the certificate it replaces', async () => {
    const { authority, session } = await authorityWith();

    const issue = await authority.issue(ip, await currentChain());

    expect([issue.outcome === 'issued' && issue.renewal, session.orders]).toEqual([
        true,
        [
            {
                identifiers: [{ type: 'ip', value: address }],
                profile: 'shortlived',
                replaces: 'aYhba4dGQEHhs3uEe6CuLN4ByNQ.AIdlQyE',
            },
        ],
    ]);
});
it('logs a renewal through ARI', async () => {
    const { authority, logs } = await authorityWith();

    await authority.issue(ip, await currentChain());

    expect(logs).toEqual(['Let’s Encrypt: 82.66.118.204 renewed through ARI']);
});
it('orders a new certificate once when Let’s Encrypt refuses the renewal', async () => {
    const { authority, session } = await authorityWith();

    session.replacesFailure = new Error('Certificate has already been replaced');

    const issue = await authority.issue(ip, await currentChain());

    expect([issue.outcome === 'issued' && issue.renewal, session.orders]).toEqual([
        false,
        [{ identifiers: [{ type: 'ip', value: address }], profile: 'shortlived' }],
    ]);
});
it('logs why the renewal was refused', async () => {
    const { authority, session, logs } = await authorityWith();

    session.replacesFailure = new Error('Certificate has already been replaced');

    await authority.issue(ip, await currentChain());

    expect(logs).toEqual([
        'Let’s Encrypt: ARI renewal of 82.66.118.204 refused (Certificate has already been replaced), ordering a new certificate',
    ]);
});
it('orders nothing more when the renewal meets a rate limit', async () => {
    const { authority, session } = await authorityWith();

    session.replacesFailure = new Error('too many failed authorizations recently');

    const issue = await authority.issue(ip, await currentChain());

    expect([issue, session.requested.length]).toEqual([
        { outcome: 'refused', reason: 'rate-limited', retryAfter: null },
        1,
    ]);
});
it('orders a new certificate when the current one cannot be named', async () => {
    const { authority, session } = await authorityWith();

    const issue = await authority.issue(ip, await currentChain(null));

    expect([issue.outcome === 'issued' && issue.renewal, session.requested]).toEqual([
        false,
        [{ identifiers: [{ type: 'ip', value: address }], profile: 'shortlived' }],
    ]);
});
