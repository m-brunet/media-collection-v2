import acme from 'acme-client';
import { X509Certificate } from 'node:crypto';
import type {
    CertificateAuthority,
    CertificateIssue,
    CertificateSubject,
} from '../../../../application/ports/driven/certificate-authority.interface.js';
import type { AcmeAccountKey } from '../filesystem/acme-account-key.adapter.js';
import type { TlsAlpnChallenges } from '../security/tls-alpn-challenges.adapter.js';
import type { AcmeConnector } from './acme-session.adapter.js';

type Refusal = Extract<CertificateIssue, { outcome: 'refused' }>['reason'];

// Let's Encrypt certificates proven with TLS-ALPN-01, the HTTPS listener answering the check
// through the shared challenge store: short-lived for an IP address (the only profile Let's Encrypt
// allows for one), classic (90 days today) for a domain name.
export class AcmeCertificateAuthority implements CertificateAuthority {
    constructor(
        private readonly connector: AcmeConnector,
        private readonly accountKey: AcmeAccountKey,
        private readonly challenges: TlsAlpnChallenges,
    ) {}

    async issue(subject: CertificateSubject): Promise<CertificateIssue> {
        const client = this.connector.open(await this.accountKey.load());

        try {
            await client.createAccount({ termsOfServiceAgreed: true });
            const order = await client.createOrder({
                identifiers: [
                    { type: subject.kind === 'domain' ? 'dns' : 'ip', value: subject.name },
                ],
                profile: subject.kind === 'domain' ? 'classic' : 'shortlived',
            } as Parameters<typeof client.createOrder>[0]);
            const [authorization] = await client.getAuthorizations(order);
            const challenge = authorization?.challenges.find(
                // acme-client's types list only dns-01 and http-01, but it supports tls-alpn-01.
                (candidate) => (candidate.type as string) === 'tls-alpn-01',
            );

            if (!authorization || !challenge) {
                return { outcome: 'refused', reason: 'authority-unavailable' };
            }

            const proven = await this.prove(client, authorization, challenge, subject);

            if (proven) {
                return { outcome: 'refused', reason: proven };
            }

            const [key, request] = await acme.crypto.createCsr({ altNames: [subject.name] });
            const finalized = await client.finalizeOrder(order, request);
            const chain = await client.getCertificate(finalized);
            const leaf = new X509Certificate(chain);

            return {
                outcome: 'issued',
                certificate: {
                    chain,
                    key: key.toString(),
                    issuedAt: new Date(leaf.validFrom).toISOString(),
                    expiresAt: new Date(leaf.validTo).toISOString(),
                },
            };
        } catch (error) {
            return { outcome: 'refused', reason: AcmeCertificateAuthority.refusal(error) };
        }
    }

    private async prove(
        client: ReturnType<AcmeConnector['open']>,
        authorization: acme.Authorization,
        challenge: acme.Authorization['challenges'][number],
        subject: CertificateSubject,
    ): Promise<Refusal | null> {
        const keyAuthorization = await client.getChallengeKeyAuthorization(challenge);
        const [key, cert] = await acme.crypto.createAlpnCertificate(
            authorization,
            keyAuthorization,
        );

        this.challenges.add(subject, { key: key.toString(), cert: cert.toString() });

        try {
            await client.completeChallenge(challenge);
            await client.waitForValidStatus(challenge);

            return null;
        } catch (error) {
            const refusal = AcmeCertificateAuthority.refusal(error);

            return refusal === 'rate-limited' ? refusal : 'not-reachable';
        } finally {
            this.challenges.remove(subject);
        }
    }

    private static refusal(error: unknown): Refusal {
        const message = error instanceof Error ? error.message.toLowerCase() : '';

        return message.includes('too many') || message.includes('rate limit')
            ? 'rate-limited'
            : 'authority-unavailable';
    }
}
