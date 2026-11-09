import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface ReadDomainNameUseCase {
    execute(actor: Actor): Promise<string | null>;
}
