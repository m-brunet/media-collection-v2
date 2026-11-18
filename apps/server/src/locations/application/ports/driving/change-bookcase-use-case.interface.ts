import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookcaseChanges, BookcaseView } from '../../location-views.js';

export interface ChangeBookcaseUseCase {
    execute(actor: Actor, bookcaseId: string, changes: BookcaseChanges): Promise<BookcaseView>;
}
