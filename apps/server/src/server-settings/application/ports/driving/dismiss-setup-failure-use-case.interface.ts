import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DismissSetupFailureUseCase {
    execute(actor: Actor): Promise<void>;
}
