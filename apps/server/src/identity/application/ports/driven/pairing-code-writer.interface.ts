import type { PairingCode } from '../../../domain/entities/pairing-code.entity.js';

export interface PairingCodeWriter {
    replace(code: PairingCode): Promise<void>;
}
