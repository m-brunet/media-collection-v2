import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookInput } from '../../book-input.js';
import type { BookView } from '../../book-views.js';

export interface CreateBookUseCase {
    // Saves a new edition; the creator may also set their own reading status.
    execute(actor: Actor, input: BookInput, read: boolean): Promise<BookView>;
}
