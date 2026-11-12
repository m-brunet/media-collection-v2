import type { PairingCodeWriter } from './pairing-code-writer.interface.js';
import type { RedeemablePairingCodes } from './redeemable-pairing-codes.interface.js';

export interface PairingCodeRepository extends PairingCodeWriter, RedeemablePairingCodes {}
