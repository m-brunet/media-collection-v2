import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeleteShelfUseCase {
    // Unassigns its books, which are kept.
    execute(actor: Actor, shelfId: string): Promise<void>;
}
