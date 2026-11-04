import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeleteBookUseCase {
    execute(actor: Actor, bookId: string): Promise<void>;
}
