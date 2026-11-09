import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { InternetAccessView } from './internet-access-view.interface.js';

export interface ReadInternetAccessUseCase {
    execute(actor: Actor): Promise<InternetAccessView>;
}
