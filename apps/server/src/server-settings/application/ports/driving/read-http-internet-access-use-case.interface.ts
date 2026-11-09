import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { HttpInternetAccessView } from './http-internet-access-view.interface.js';

export interface ReadHttpInternetAccessUseCase {
    execute(actor: Actor): Promise<HttpInternetAccessView>;
}
