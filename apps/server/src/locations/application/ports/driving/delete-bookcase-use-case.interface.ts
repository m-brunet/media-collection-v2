import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeleteBookcaseUseCase {
    // Removes its shelves and unassigns their books, which are kept.
    execute(actor: Actor, bookcaseId: string): Promise<void>;
}
