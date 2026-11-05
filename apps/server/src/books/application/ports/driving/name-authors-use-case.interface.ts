import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { AuthorView } from '../../book-views.js';

export interface NameAuthorsUseCase {
    // The names of the given authors, for showing chosen authors (for example in filters).
    // Unknown ids are left out.
    execute(actor: Actor, ids: readonly string[]): Promise<AuthorView[]>;
}
