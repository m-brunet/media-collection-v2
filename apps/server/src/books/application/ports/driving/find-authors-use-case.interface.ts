import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { AuthorView } from '../../book-views.js';

export interface FindAuthorsUseCase {
    execute(actor: Actor, search: string): Promise<AuthorView[]>;
}
