import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeleteNoteUseCase {
    execute(actor: Actor, id: string): Promise<void>;
}
