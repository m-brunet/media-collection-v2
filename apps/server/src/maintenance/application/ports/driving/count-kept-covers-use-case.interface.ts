import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface CountKeptCoversUseCase {
    execute(actor: Actor): Promise<number>;
}
