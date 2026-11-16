import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeleteKeptCoversUseCase {
    execute(actor: Actor): Promise<number>;
}
