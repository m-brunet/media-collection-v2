import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from 'selfsigned';
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

// Plays Let's Encrypt's side of one order. `validation` decides how the TLS-ALPN-01 check ends.
class ScriptedSession {
    readonly orders: unknown[] = [];
    challengeWaiting = false;
    orderFailure: Error | null = null;
    validationFailure: Error | null = null;
    challengeTypes = ['http-01', 'tls-alpn-01'];

    constructor(
        private readonly challenges: TlsAlpnChallenges,
        private readonly chain: string,
    ) {}

    async createAccount() {
        return {};
    }

    async createOrder(order: unknown) {
        if (this.orderFailure) {
            throw this.orderFailure;
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
    const authority = new AcmeCertificateAuthority(
        new ScriptedConnector(session),
        new AcmeAccountKey(directory, new PrivateStorage()),
        challenges,
    );

    directories.push(directory);

    return { authority, session, challenges };
}

it('issues a short-lived certificate for the public IP address', async () => {
    const { authority, session } = await authorityWith();

    const issue = await authority.issue(ip);

    expect([issue.outcome, session.orders]).toEqual([
        'issued',
        [{ identifiers: [{ type: 'ip', value: address }], profile: 'shortlived' }],
    ]);
});
it('gives the new private key with the certificate', async () => {
    const { authority } = await authorityWith();

    const issue = await authority.issue(ip);

    expect(issue.outcome === 'issued' && issue.certificate.key).toContain('PRIVATE KEY');
});
it('offers the challenge answer while Let’s Encrypt checks, then withdraws it', async () => {
    const { authority, session, challenges } = await authorityWith();

    await authority.issue(ip);

    expect([
        session.challengeWaiting,
        challenges.contextFor(TlsAlpnChallenges.serverName(ip)),
    ]).toEqual([true, undefined]);
});
it('reports an unreachable port when the check fails', async () => {
    const { authority, session } = await authorityWith();

    session.validationFailure = new Error('Timeout after connect (your server may be slow)');

    const issue = await authority.issue(ip);

    expect(issue).toEqual({ outcome: 'refused', reason: 'not-reachable' });
});
it('reports Let’s Encrypt limits', async () => {
    const { authority, session } = await authorityWith();

    session.orderFailure = new Error('too many certificates (5) already issued for this exact set');

    const issue = await authority.issue(ip);

    expect(issue).toEqual({ outcome: 'refused', reason: 'rate-limited' });
});
it('reports Let’s Encrypt as unavailable on any other error', async () => {
    const { authority, session } = await authorityWith();

    session.orderFailure = new Error('getaddrinfo ENOTFOUND acme-v02.api.letsencrypt.org');

    const issue = await authority.issue(ip);

    expect(issue).toEqual({ outcome: 'refused', reason: 'authority-unavailable' });
});
it('reports Let’s Encrypt as unavailable without a TLS-ALPN-01 challenge', async () => {
    const { authority, session } = await authorityWith();

    session.challengeTypes = ['http-01'];

    const issue = await authority.issue(ip);

    expect(issue).toEqual({ outcome: 'refused', reason: 'authority-unavailable' });
});
it('issues a classic certificate for a domain name', async () => {
    const { authority, session } = await authorityWith();

    const issue = await authority.issue(domain);

    expect([issue.outcome, session.orders]).toEqual([
        'issued',
        [{ identifiers: [{ type: 'dns', value: 'home.example.fr' }], profile: 'classic' }],
    ]);
});
it('offers the domain challenge answer under the domain name, then withdraws it', async () => {
    const { authority, session, challenges } = await authorityWith();

    await authority.issue(domain);

    expect([session.challengeWaiting, challenges.contextFor('home.example.fr')]).toEqual([
        true,
        undefined,
    ]);
});
