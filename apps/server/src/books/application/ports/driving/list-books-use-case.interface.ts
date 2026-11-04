import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookListPage, BookListQuery } from '../../book-views.js';

export interface ListBooksUseCase {
    execute(actor: Actor, query: Omit<BookListQuery, 'readerId'>): Promise<BookListPage>;
}
