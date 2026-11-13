import { createHash, randomBytes } from 'node:crypto';
import type { PairingSecrets } from '../../../../application/ports/driven/pairing-secrets.interface.js';

export class CryptoPairingSecrets implements PairingSecrets {
    generate(): string {
        return randomBytes(32).toString('base64url');
    }

    hash(code: string): string {
        return createHash('sha256').update(code).digest('base64url');
    }
}
