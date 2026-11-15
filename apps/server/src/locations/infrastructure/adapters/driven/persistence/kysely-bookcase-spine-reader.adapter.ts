import type { BookcaseSpineReader } from '../../../../application/ports/driven/bookcase-spine-reader.interface.js';
import type { SpineBookView, SpineCategory } from '../../../../application/location-views.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import { KyselyShelfOrder } from '../../../../../shared/infrastructure/adapters/driven/persistence/kysely-shelf-order.adapter.js';

export class KyselyBookcaseSpineReader implements BookcaseSpineReader {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async booksOn(shelfIds: readonly string[]): Promise<Map<string, SpineBookView[]>> {
        const shelved = new Map<string, SpineBookView[]>();

        if (shelfIds.length === 0) {
            return shelved;
        }

        const rows = await KyselyShelfOrder.apply(
            this.db
                .selectFrom('book_shelves')
                .innerJoin('books', 'books.id', 'book_shelves.book_id')
                .leftJoin('collection_books', 'collection_books.book_id', 'books.id')
                .leftJoin('collections', 'collections.id', 'collection_books.collection_id')
                .select([
                    'book_shelves.shelf_id',
                    'books.id',
                    'books.title',
                    'books.category',
                    'books.page_count',
                ])
                .where('book_shelves.shelf_id', 'in', [...shelfIds]),
        ).execute();
        const authors = await this.authorNames(rows.map((row) => row.id));

        for (const row of rows) {
            const books = shelved.get(row.shelf_id) ?? [];

            books.push({
                id: row.id,
                title: row.title,
                authors: authors.get(row.id) ?? [],
                category: row.category as SpineCategory,
                pageCount: row.page_count,
            });
            shelved.set(row.shelf_id, books);
        }

        return shelved;
    }

    private async authorNames(bookIds: string[]): Promise<Map<string, string[]>> {
        const names = new Map<string, string[]>();

        if (bookIds.length === 0) {
            return names;
        }

        const rows = await this.db
            .selectFrom('book_authors')
            .innerJoin('authors', 'authors.id', 'book_authors.author_id')
            .select(['book_authors.book_id', 'authors.name'])
            .where('book_authors.book_id', 'in', bookIds)
            .orderBy('book_authors.book_id')
            .orderBy('book_authors.position')
            .execute();

        for (const row of rows) {
            names.set(row.book_id, [...(names.get(row.book_id) ?? []), row.name]);
        }

        return names;
    }
}
