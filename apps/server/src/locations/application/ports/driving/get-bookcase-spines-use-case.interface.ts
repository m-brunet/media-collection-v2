import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookcaseSpinesView } from '../../location-views.js';

export interface GetBookcaseSpinesUseCase {
    execute(actor: Actor, bookcaseId: string): Promise<BookcaseSpinesView>;
}
