import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface CreatePairingCodeUseCase {
    execute(actor: Actor, address: string): Promise<{ link: string; expiresAt: string }>;
}
