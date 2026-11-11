export interface TlsCertificateReader {
    currentChain(): Promise<string | null>;
}
