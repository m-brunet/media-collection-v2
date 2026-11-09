import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { HttpInternetAccessState } from '../../../domain/entities/http-internet-access.entity.js';

export interface CloseHttpInternetAccessUseCase {
    execute(actor: Actor): Promise<HttpInternetAccessState>;
}
