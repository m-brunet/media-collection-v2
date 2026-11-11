import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeleteBookcaseUseCase {
    execute(actor: Actor, bookcaseId: string): Promise<void>;
}
