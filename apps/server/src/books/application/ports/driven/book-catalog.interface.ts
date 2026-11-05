import type { AuthorView, BookListPage, BookListQuery } from '../../book-views.js';
// Read-only queries over the library: searching and sorting books, finding authors.
export interface BookCatalog {
    search(query: BookListQuery): Promise<BookListPage>;
    authorsOf(bookId: string): Promise<AuthorView[]>;
}
