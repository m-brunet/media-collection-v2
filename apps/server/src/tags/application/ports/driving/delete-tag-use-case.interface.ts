import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeleteTagUseCase {
    // Removes the tag from its books, which are kept.
    execute(actor: Actor, tagId: string): Promise<void>;
}
