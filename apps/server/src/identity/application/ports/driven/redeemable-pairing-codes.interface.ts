import type { PairingCode } from '../../../domain/entities/pairing-code.entity.js';

export interface RedeemablePairingCodes {
    findByHash(codeHash: string): Promise<PairingCode | null>;
    consume(code: PairingCode): Promise<boolean>;
}
