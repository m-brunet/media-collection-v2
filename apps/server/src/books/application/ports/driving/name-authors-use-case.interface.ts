import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { AuthorView } from '../../book-views.js';

export interface NameAuthorsUseCase {
    // Unknown ids are left out.
    execute(actor: Actor, ids: readonly string[]): Promise<AuthorView[]>;
}
