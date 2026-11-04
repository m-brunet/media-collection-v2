import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { AuthorView } from '../../book-views.js';

export interface FindAuthorsUseCase {
    // Existing authors whose name contains the search, for choosing one in the form.
    execute(actor: Actor, search: string): Promise<AuthorView[]>;
}
