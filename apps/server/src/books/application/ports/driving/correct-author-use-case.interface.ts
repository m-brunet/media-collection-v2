import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { AuthorView } from '../../book-views.js';

export interface CorrectAuthorUseCase {
    execute(actor: Actor, authorId: string, name: string): Promise<AuthorView>;
}
