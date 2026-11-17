import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface FindPublishersUseCase {
    execute(actor: Actor, search: string): Promise<string[]>;
}
