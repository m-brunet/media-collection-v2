import type { AuthorView, BookListQuery, CatalogPage } from '../../book-views.js';
export interface BookCatalog {
    search(query: BookListQuery): Promise<CatalogPage>;
    authorsOf(bookId: string): Promise<AuthorView[]>;
}
