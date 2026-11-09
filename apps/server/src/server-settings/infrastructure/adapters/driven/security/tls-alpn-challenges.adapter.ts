import type { SecureContext } from 'node:tls';
import { createSecureContext } from 'node:tls';

// The TLS-ALPN-01 answers waiting for Let's Encrypt (RFC 8737, RFC 8738). For an IP address,
// Let's Encrypt names the address in its reverse-DNS form, for example
// `204.118.66.82.in-addr.arpa`, and asks for the `acme-tls/1` protocol.
export class TlsAlpnChallenges {
    static readonly protocol = 'acme-tls/1';
    private readonly contexts = new Map<string, SecureContext>();

    static serverName(address: string): string {
        return address.split('.').reverse().join('.') + '.in-addr.arpa';
    }

    add(address: string, certificate: { key: string; cert: string }): void {
        this.contexts.set(
            TlsAlpnChallenges.serverName(address),
            createSecureContext({ ...certificate, minVersion: 'TLSv1.2' }),
        );
    }

    remove(address: string): void {
        this.contexts.delete(TlsAlpnChallenges.serverName(address));
    }

    contextFor(serverName: string): SecureContext | undefined {
        return this.contexts.get(serverName.toLowerCase());
    }
}
