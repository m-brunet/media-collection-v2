import acme from 'acme-client';
import { X509Certificate } from 'node:crypto';
import type {
    CertificateAuthority,
    CertificateIssue,
} from '../../../../application/ports/driven/certificate-authority.interface.js';
import type { AcmeAccountKey } from '../filesystem/acme-account-key.adapter.js';
import type { TlsAlpnChallenges } from '../security/tls-alpn-challenges.adapter.js';
import type { AcmeConnector } from './acme-session.adapter.js';

type Refusal = Extract<CertificateIssue, { outcome: 'refused' }>['reason'];

// Let's Encrypt, short-lived IP address certificates proven with TLS-ALPN-01: the HTTPS listener
// answers the check through the shared challenge store.
export class AcmeCertificateAuthority implements CertificateAuthority {
    constructor(
        private readonly connector: AcmeConnector,
        private readonly accountKey: AcmeAccountKey,
        private readonly challenges: TlsAlpnChallenges,
    ) {}

    async issue(address: string): Promise<CertificateIssue> {
        const client = this.connector.open(await this.accountKey.load());

        try {
            await client.createAccount({ termsOfServiceAgreed: true });
            const order = await client.createOrder({
                identifiers: [{ type: 'ip', value: address }],
                profile: 'shortlived',
            } as Parameters<typeof client.createOrder>[0]);
            const [authorization] = await client.getAuthorizations(order);
            const challenge = authorization?.challenges.find(
                // acme-client's types list only dns-01 and http-01, but it supports tls-alpn-01.
                (candidate) => (candidate.type as string) === 'tls-alpn-01',
            );

            if (!authorization || !challenge) {
                return { outcome: 'refused', reason: 'authority-unavailable' };
            }

            const proven = await this.prove(client, authorization, challenge, address);

            if (proven) {
                return { outcome: 'refused', reason: proven };
            }

            const [key, request] = await acme.crypto.createCsr({ altNames: [address] });
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

    // Null once Let's Encrypt reached the port, otherwise why it could not.
    private async prove(
        client: ReturnType<AcmeConnector['open']>,
        authorization: acme.Authorization,
        challenge: acme.Authorization['challenges'][number],
        address: string,
    ): Promise<Refusal | null> {
        const keyAuthorization = await client.getChallengeKeyAuthorization(challenge);
        const [key, cert] = await acme.crypto.createAlpnCertificate(
            authorization,
            keyAuthorization,
        );

        this.challenges.add(address, { key: key.toString(), cert: cert.toString() });

        try {
            await client.completeChallenge(challenge);
            await client.waitForValidStatus(challenge);

            return null;
        } catch (error) {
            const refusal = AcmeCertificateAuthority.refusal(error);

            return refusal === 'rate-limited' ? refusal : 'not-reachable';
        } finally {
            this.challenges.remove(address);
        }
    }

    private static refusal(error: unknown): Refusal {
        const message = error instanceof Error ? error.message.toLowerCase() : '';

        return message.includes('too many') || message.includes('rate limit')
            ? 'rate-limited'
            : 'authority-unavailable';
    }
}
