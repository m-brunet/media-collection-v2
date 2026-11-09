import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { InternetAccessState } from '../../../domain/entities/internet-access.entity.js';

export interface SetUpInternetAccessUseCase {
    execute(
        actor: Actor,
        input: { replaceCertificate: boolean; domain: string | null },
    ): Promise<InternetAccessState>;
}
