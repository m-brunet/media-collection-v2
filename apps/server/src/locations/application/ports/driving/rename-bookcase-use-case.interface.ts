import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookcaseView } from '../../location-views.js';

export interface RenameBookcaseUseCase {
    execute(actor: Actor, bookcaseId: string, name: string): Promise<BookcaseView>;
}
