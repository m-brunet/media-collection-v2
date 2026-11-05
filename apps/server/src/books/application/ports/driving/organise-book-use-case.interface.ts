import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { OrganisationRequest } from '../../book-input.js';
import type { BookView } from '../../book-views.js';

export interface OrganiseBookUseCase {
    // Changes only where the book is kept and how it is tagged.
    execute(actor: Actor, bookId: string, request: OrganisationRequest): Promise<BookView>;
}
