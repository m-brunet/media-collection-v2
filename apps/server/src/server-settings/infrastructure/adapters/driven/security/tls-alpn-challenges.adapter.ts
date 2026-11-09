import type { SecureContext } from 'node:tls';
import { createSecureContext } from 'node:tls';
import type { CertificateSubject } from '../../../../application/ports/driven/certificate-authority.interface.js';

// The TLS-ALPN-01 answers waiting for Let's Encrypt (RFC 8737, RFC 8738), by the server name it
// asks for with the `acme-tls/1` protocol: the domain name itself, or for an IP address its
// reverse-DNS form, for example `204.118.66.82.in-addr.arpa`.
export class TlsAlpnChallenges {
    static readonly protocol = 'acme-tls/1';
    private readonly contexts = new Map<string, SecureContext>();

    static serverName(subject: CertificateSubject): string {
        return subject.kind === 'domain'
            ? subject.name.toLowerCase()
            : subject.name.split('.').reverse().join('.') + '.in-addr.arpa';
    }

    add(subject: CertificateSubject, certificate: { key: string; cert: string }): void {
        this.contexts.set(
            TlsAlpnChallenges.serverName(subject),
            createSecureContext({ ...certificate, minVersion: 'TLSv1.2' }),
        );
    }

    remove(subject: CertificateSubject): void {
        this.contexts.delete(TlsAlpnChallenges.serverName(subject));
    }

    contextFor(serverName: string): SecureContext | undefined {
        return this.contexts.get(serverName.toLowerCase());
    }
}
