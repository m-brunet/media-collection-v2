import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { InternetAccessState } from '../../../domain/entities/internet-access.entity.js';

export interface CheckInternetAccessUseCase {
    execute(actor: Actor): Promise<InternetAccessState>;
}
