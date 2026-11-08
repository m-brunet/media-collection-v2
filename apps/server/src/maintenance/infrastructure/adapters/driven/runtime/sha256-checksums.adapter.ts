import { createHash } from 'node:crypto';
import type { Checksums } from '../../../../application/ports/driven/checksums.interface.js';

export class Sha256Checksums implements Checksums {
    of(bytes: Uint8Array): string {
        return createHash('sha256').update(bytes).digest('hex');
    }
}
