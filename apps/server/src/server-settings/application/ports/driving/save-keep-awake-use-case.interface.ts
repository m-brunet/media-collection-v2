import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface SaveKeepAwakeUseCase {
    execute(actor: Actor, input: { enabled: boolean }): Promise<boolean>;
}
