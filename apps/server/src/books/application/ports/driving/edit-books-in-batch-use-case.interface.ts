import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookBatchRequest, BookBatchView } from '../../book-batch.js';

export interface EditBooksInBatchUseCase {
    execute(actor: Actor, request: BookBatchRequest): Promise<BookBatchView>;
}
