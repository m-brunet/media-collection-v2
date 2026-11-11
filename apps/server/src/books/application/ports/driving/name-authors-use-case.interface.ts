import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { AuthorView } from '../../book-views.js';

export interface NameAuthorsUseCase {
    execute(actor: Actor, ids: readonly string[]): Promise<AuthorView[]>;
}
