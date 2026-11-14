import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DismissAddressNoticeUseCase {
    execute(actor: Actor): Promise<void>;
}
