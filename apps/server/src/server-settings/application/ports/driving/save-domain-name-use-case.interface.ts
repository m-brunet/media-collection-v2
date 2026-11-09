import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface SaveDomainNameUseCase {
    execute(actor: Actor, input: { domain: string | null }): Promise<string | null>;
}
