import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { TagView } from '../../tag-views.js';

export interface ListTagsUseCase {
    execute(actor: Actor, search: string): Promise<TagView[]>;
}
