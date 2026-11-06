import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { ReceiverReference } from '../../lending-input.js';

export interface FindReceiversUseCase {
    // Existing receivers whose name contains the search, for choosing one in the lending form.
    execute(actor: Actor, search: string): Promise<ReceiverReference[]>;
}
