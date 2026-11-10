import type { ListBooksUseCase } from '../ports/driving/list-books-use-case.interface.js';
import type { BookListPage, BookListQuery } from '../book-views.js';
import type { BookCatalog } from '../ports/driven/book-catalog.interface.js';
import type { BookLoanReader } from '../ports/driven/book-loan-reader.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class ListBooks implements ListBooksUseCase {
    constructor(
        private readonly catalog: BookCatalog,
        private readonly loans: BookLoanReader,
    ) {}

    async execute(actor: Actor, query: Omit<BookListQuery, 'readerId'>): Promise<BookListPage> {
        ActorAuthorization.requireReady(actor);

        const page = await this.catalog.search({
            ...query,
            readerId: query.filter.readerFor(actor),
        });
        const loans = await this.loans.ofBooks(page.items.map((item) => item.id));

        return {
            total: page.total,
            items: page.items.map((item) => ({ ...item, loan: loans.get(item.id) ?? null })),
        };
    }
}
