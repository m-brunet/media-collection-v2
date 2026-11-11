import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookcaseView } from '../../location-views.js';

export interface ListBookcasesUseCase {
    execute(actor: Actor): Promise<BookcaseView[]>;
}
