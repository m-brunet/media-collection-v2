import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { TagView } from '../../tag-views.js';

export interface CreateTagUseCase {
    execute(actor: Actor, name: string): Promise<TagView>;
}
