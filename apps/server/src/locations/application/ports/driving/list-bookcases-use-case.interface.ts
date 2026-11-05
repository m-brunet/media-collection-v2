import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookcaseView } from '../../location-views.js';

export interface ListBookcasesUseCase {
    // Every bookcase with its shelves and book counts, by name.
    execute(actor: Actor): Promise<BookcaseView[]>;
}
