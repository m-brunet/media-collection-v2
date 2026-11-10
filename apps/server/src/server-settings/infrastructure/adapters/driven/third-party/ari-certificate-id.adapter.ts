import { AuthorityKeyIdentifierExtension, PemConverter, X509Certificate } from '@peculiar/x509';

// The ARI certificate identifier (RFC 9773, section 4.1) of the first certificate of a PEM chain:
// base64url of its Authority Key Identifier, a dot, base64url of its serial number as encoded in
// the certificate (DER integer bytes, a leading zero byte included).
export class AriCertificateId {
    static of(chain: string): string {
        const [leaf] = PemConverter.decode(chain);

        if (!leaf) {
            throw new Error('The certificate chain is empty.');
        }

        const certificate = new X509Certificate(leaf);
        const keyId = certificate.getExtension(AuthorityKeyIdentifierExtension)?.keyId;

        if (!keyId) {
            throw new Error('The certificate has no Authority Key Identifier.');
        }

        return (
            Buffer.from(keyId, 'hex').toString('base64url') +
            '.' +
            AriCertificateId.encodedSerial(certificate.serialNumber).toString('base64url')
        );
    }

    // `serialNumber` drops the zero byte DER puts before a positive integer whose first byte has its
    // high bit set; the identifier keeps the bytes as encoded, so the byte is put back.
    private static encodedSerial(hex: string): Buffer {
        const bytes = Buffer.from(hex, 'hex');

        return bytes[0]! > 0x7f ? Buffer.concat([Buffer.from([0]), bytes]) : bytes;
    }
}
