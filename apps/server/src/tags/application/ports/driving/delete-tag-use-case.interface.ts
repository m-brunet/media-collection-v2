import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeleteTagUseCase {
    execute(actor: Actor, tagId: string): Promise<void>;
}
