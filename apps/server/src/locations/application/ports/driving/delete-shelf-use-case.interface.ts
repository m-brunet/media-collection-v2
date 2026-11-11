import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeleteShelfUseCase {
    execute(actor: Actor, shelfId: string): Promise<void>;
}
