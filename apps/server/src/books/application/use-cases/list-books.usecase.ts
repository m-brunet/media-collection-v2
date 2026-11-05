import type { ListBooksUseCase } from '../ports/driving/list-books-use-case.interface.js';
import type { BookListPage, BookListQuery } from '../book-views.js';
import type { BookCatalog } from '../ports/driven/book-catalog.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// The shared library list; each Owner or the administrator sees, and may filter on, their own
// reading status. Guests have no reading status to filter on.
export class ListBooks implements ListBooksUseCase {
    constructor(private readonly catalog: BookCatalog) {}

    async execute(actor: Actor, query: Omit<BookListQuery, 'readerId'>): Promise<BookListPage> {
        ActorAuthorization.requireReady(actor);

        return this.catalog.search({ ...query, readerId: query.filter.readerFor(actor) });
    }
}
