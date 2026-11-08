import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface ResetApplicationDataUseCase {
    execute(actor: Actor, password: string): Promise<void>;
}
