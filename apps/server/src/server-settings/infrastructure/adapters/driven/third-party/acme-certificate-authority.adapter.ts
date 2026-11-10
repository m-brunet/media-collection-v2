import acme from 'acme-client';
import { X509Certificate } from 'node:crypto';
import type {
    CertificateAuthority,
    CertificateIssue,
    CertificateSubject,
} from '../../../../application/ports/driven/certificate-authority.interface.js';
import type { AcmeAccountKey } from '../filesystem/acme-account-key.adapter.js';
import type { TlsAlpnChallenges } from '../security/tls-alpn-challenges.adapter.js';
import type { AcmeConnector, AcmeSession } from './acme-session.adapter.js';
import { AriCertificateId } from './ari-certificate-id.adapter.js';

type Refused = Extract<CertificateIssue, { outcome: 'refused' }>;
type OrderRequest = Parameters<AcmeSession['createOrder']>[0];

// Let's Encrypt certificates proven with TLS-ALPN-01, the HTTPS listener answering the check
// through the shared challenge store: short-lived for an IP address (the only profile Let's Encrypt
// allows for one), classic (90 days today) for a domain name. A renewal of the same name is ordered
// through ARI (RFC 9773, `replaces`), which Let's Encrypt exempts from every rate limit.
export class AcmeCertificateAuthority implements CertificateAuthority {
    constructor(
        private readonly connector: AcmeConnector,
        private readonly accountKey: AcmeAccountKey,
        private readonly challenges: TlsAlpnChallenges,
        private readonly log: (line: string) => void = console.log,
    ) {}

    async issue(subject: CertificateSubject, replacing: string | null): Promise<CertificateIssue> {
        const client = this.connector.open(await this.accountKey.load());

        try {
            await client.createAccount({ termsOfServiceAgreed: true });
            const { order, renewal } = await this.order(client, subject, replacing);
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
                return proven;
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
                renewal,
            };
        } catch (error) {
            return AcmeCertificateAuthority.refused(error);
        }
    }

    // A refused ARI order (certificate already replaced or unknown, field not accepted) is ordered
    // once more as a new certificate; a rate limit is not, as the new order would count.
    private async order(
        client: AcmeSession,
        subject: CertificateSubject,
        replacing: string | null,
    ): Promise<{ order: acme.Order; renewal: boolean }> {
        const request = {
            identifiers: [{ type: subject.kind === 'domain' ? 'dns' : 'ip', value: subject.name }],
            profile: subject.kind === 'domain' ? 'classic' : 'shortlived',
        };
        const replaces = replacing ? this.identifier(replacing) : null;

        if (replaces) {
            try {
                const order = await client.createOrder({ ...request, replaces } as OrderRequest);

                this.log('Let’s Encrypt: ' + subject.name + ' renewed through ARI');

                return { order, renewal: true };
            } catch (error) {
                if (AcmeCertificateAuthority.refused(error).reason === 'rate-limited') {
                    throw error;
                }

                this.log(
                    'Let’s Encrypt: ARI renewal of ' +
                        subject.name +
                        ' refused (' +
                        (error instanceof Error ? error.message : String(error)) +
                        '), ordering a new certificate',
                );
            }
        }

        return { order: await client.createOrder(request as OrderRequest), renewal: false };
    }

    // A certificate without an Authority Key Identifier (one imported by hand) cannot be named.
    private identifier(chain: string): string | null {
        try {
            return AriCertificateId.of(chain);
        } catch {
            return null;
        }
    }

    private async prove(
        client: AcmeSession,
        authorization: acme.Authorization,
        challenge: acme.Authorization['challenges'][number],
        subject: CertificateSubject,
    ): Promise<Refused | null> {
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
            const refused = AcmeCertificateAuthority.refused(error);

            return refused.reason === 'rate-limited'
                ? refused
                : { outcome: 'refused', reason: 'not-reachable' };
        } finally {
            this.challenges.remove(subject);
        }
    }

    // Let's Encrypt writes its date in the rate-limit message ("…, retry after 2026-11-12 23:30:00 UTC:
    // see https://letsencrypt.org/docs/rate-limits/…"); acme-client keeps no response header.
    private static refused(error: unknown): Refused {
        const message = error instanceof Error ? error.message : '';
        const lower = message.toLowerCase();

        if (!lower.includes('too many') && !lower.includes('rate limit')) {
            return { outcome: 'refused', reason: 'authority-unavailable' };
        }

        const date = message.match(/retry after (\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/i);
        const at = date ? Date.parse(date[1] + 'T' + date[2] + 'Z') : Number.NaN;

        return {
            outcome: 'refused',
            reason: 'rate-limited',
            retryAfter: Number.isFinite(at) ? new Date(at).toISOString() : null,
        };
    }
}
