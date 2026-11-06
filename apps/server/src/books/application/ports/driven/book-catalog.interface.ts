import type { AuthorView, BookListQuery, CatalogPage } from '../../book-views.js';
// Read-only queries over the library: searching and sorting books, finding authors.
export interface BookCatalog {
    search(query: BookListQuery): Promise<CatalogPage>;
    authorsOf(bookId: string): Promise<AuthorView[]>;
}
