import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface RedeemPairingCodeUseCase {
    execute(code: string): Promise<{ actor: Actor; token: string }>;
}
