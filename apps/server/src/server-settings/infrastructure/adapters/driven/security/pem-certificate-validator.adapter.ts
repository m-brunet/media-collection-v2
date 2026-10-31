import { createPrivateKey, createPublicKey, X509Certificate } from 'node:crypto';
import { createSecureContext } from 'node:tls';
import type { CertificateValidator } from '../../../../application/ports/driven/certificate-validator.interface.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';

export class PemCertificateValidator implements CertificateValidator {
    validate(chain: string, key: string): void {
        try {
            createSecureContext({ cert: chain, key, minVersion: 'TLSv1.2' });
            const leaf = new X509Certificate(chain);
            const publicKey = createPublicKey(createPrivateKey(key)).export({
                type: 'spki',
                format: 'der',
            });

            if (!leaf.publicKey.export({ type: 'spki', format: 'der' }).equals(publicKey)) {
                throw new Error('Key mismatch');
            }

            if (Date.parse(leaf.validFrom) > Date.now() || Date.parse(leaf.validTo) <= Date.now()) {
                throw new Error('Certificate outside validity period');
            }
        } catch {
            throw new Failure(
                'invalid_input',
                'The PEM certificate and unencrypted private key must match and be currently valid.',
            );
        }
    }
}
