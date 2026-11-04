import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { AuthorView } from '../../book-views.js';

export interface CorrectAuthorUseCase {
    // Corrects the shared spelling of an author on every linked book.
    execute(actor: Actor, authorId: string, name: string): Promise<AuthorView>;
}
