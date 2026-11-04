import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeletePersonalNoteUseCase {
    execute(actor: Actor, bookId: string): Promise<void>;
}
