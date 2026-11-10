// The certificate chain HTTPS uses now (PEM), or null when none is saved. A renewal names it to
// Let's Encrypt; the private key is never read through this port.
export interface TlsCertificateReader {
    currentChain(): Promise<string | null>;
}
