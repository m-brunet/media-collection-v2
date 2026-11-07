import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookView } from '../../book-views.js';

export interface MarkBookOwnedUseCase {
    // Changes only the ownership of a Not Owned book to Owned (Leaf quick add). Owners and Admin.
    execute(actor: Actor, bookId: string): Promise<BookView>;
}
