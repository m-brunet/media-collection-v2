import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { HttpInternetAccessState } from '../../../domain/entities/http-internet-access.entity.js';

export interface OpenHttpInternetAccessUseCase {
    execute(actor: Actor): Promise<HttpInternetAccessState>;
}
