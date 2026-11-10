import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { OrganisationRequest } from '../../book-input.js';
import type { BookView } from '../../book-views.js';

export interface OrganiseBookUseCase {
    execute(actor: Actor, bookId: string, request: OrganisationRequest): Promise<BookView>;
}
