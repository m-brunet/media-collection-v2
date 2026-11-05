import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookcaseView } from '../../location-views.js';

export interface CreateBookcaseUseCase {
    execute(actor: Actor, name: string): Promise<BookcaseView>;
}
