import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookInput } from '../../book-input.js';
import type { BookView } from '../../book-views.js';

export interface UpdateBookUseCase {
    execute(actor: Actor, bookId: string, input: BookInput): Promise<BookView>;
}
