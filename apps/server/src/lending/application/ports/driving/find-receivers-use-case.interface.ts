import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { ReceiverReference } from '../../lending-input.js';

export interface FindReceiversUseCase {
    execute(actor: Actor, search: string): Promise<ReceiverReference[]>;
}
