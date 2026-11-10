import { expect, it } from 'vitest';
import {
    AuthorityKeyIdentifierExtension,
    PemConverter,
    X509CertificateGenerator,
} from '@peculiar/x509';
import { AriCertificateId } from './ari-certificate-id.adapter.js';

const algorithm = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };

// The RFC 9773 example: Authority Key Identifier 69:88:5B:6B:87:46:40:41:E1:B3:7B:84:7B:A0:AE:2C:DE:01:
// C8:D4 and serial number 0x87654321 give "aYhba4dGQEHhs3uEe6CuLN4ByNQ.AIdlQyE".
async function chain(options: { serialNumber: string; keyId?: string }) {
    const keys = await crypto.subtle.generateKey(algorithm, false, ['sign', 'verify']);
    const certificate = await X509CertificateGenerator.createSelfSigned({
        serialNumber: options.serialNumber,
        name: 'CN=82.66.118.204',
        notBefore: new Date('2026-11-08T10:00:00Z'),
        notAfter: new Date('2026-11-15T02:00:00Z'),
        keys,
        signingAlgorithm: algorithm,
        extensions: options.keyId ? [new AuthorityKeyIdentifierExtension(options.keyId)] : [],
    });

    return certificate.toString('pem');
}

it('gives the RFC 9773 identifier: key identifier, a dot, serial number with its leading zero', async () => {
    const pem = await chain({
        serialNumber: '0087654321',
        keyId: '69885b6b87464041e1b37b847ba0ae2cde01c8d4',
    });

    const id = AriCertificateId.of(pem);

    expect(id).toBe('aYhba4dGQEHhs3uEe6CuLN4ByNQ.AIdlQyE');
});
it('reads the first certificate of a chain', async () => {
    const leaf = await chain({
        serialNumber: '0087654321',
        keyId: '69885b6b87464041e1b37b847ba0ae2cde01c8d4',
    });
    const issuer = await chain({ serialNumber: '01', keyId: '0102' });

    const id = AriCertificateId.of(leaf + '\n' + issuer);

    expect(id).toBe('aYhba4dGQEHhs3uEe6CuLN4ByNQ.AIdlQyE');
});
it('refuses a certificate without an Authority Key Identifier', async () => {
    const pem = await chain({ serialNumber: '0087654321' });

    const read = () => AriCertificateId.of(pem);

    expect(read).toThrow('Authority Key Identifier');
});
it('refuses an empty chain', () => {
    const read = () => AriCertificateId.of(PemConverter.encode([], 'CERTIFICATE'));

    expect(read).toThrow('empty');
});
