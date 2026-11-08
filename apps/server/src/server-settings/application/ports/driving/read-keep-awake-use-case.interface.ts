import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface ReadKeepAwakeUseCase {
    execute(actor: Actor): Promise<boolean>;
}
