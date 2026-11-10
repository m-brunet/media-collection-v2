import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { TagView } from '../../tag-views.js';

export interface RenameTagUseCase {
    execute(actor: Actor, tagId: string, name: string): Promise<TagView>;
}
