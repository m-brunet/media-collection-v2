import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { TagView } from '../../tag-views.js';

export interface ListTagsUseCase {
    // Tags by name, with their book counts; a search keeps the names containing it.
    execute(actor: Actor, search: string): Promise<TagView[]>;
}
