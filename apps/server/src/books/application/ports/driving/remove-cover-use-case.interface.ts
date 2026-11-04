import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookView } from '../../book-views.js';

export interface RemoveCoverUseCase {
    execute(actor: Actor, bookId: string): Promise<BookView>;
}
