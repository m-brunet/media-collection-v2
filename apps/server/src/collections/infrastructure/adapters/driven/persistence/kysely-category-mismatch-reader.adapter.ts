import type { CategoryMismatchReader } from '../../../../application/ports/driven/category-mismatch-reader.interface.js';
import type { CategoryMismatchView } from '../../../../application/collection-views.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export class KyselyCategoryMismatchReader implements CategoryMismatchReader {
    constructor(private readonly connections: DatabaseConnections) {}

    async list(collectionId: string | null): Promise<CategoryMismatchView[]> {
        const mismatched = this.connections.current
            .selectFrom('collection_books')
            .innerJoin('books', 'books.id', 'collection_books.book_id')
            .innerJoin('collections', 'collections.id', 'collection_books.collection_id')
            .whereRef('books.category', '!=', 'collections.category');
        const chosen =
            collectionId === null
                ? mismatched
                : mismatched.where('collections.id', '=', collectionId);
        const rows = await chosen
            .select([
                'books.id as bookId',
                'books.title as title',
                'books.category as category',
                'collections.id as collectionId',
                'collections.name as collectionName',
                'collections.category as collectionCategory',
            ])
            .orderBy('collections.name_key')
            .orderBy('collection_books.volume_from')
            .orderBy('books.title_sort_key')
            .orderBy('books.id')
            .execute();

        return rows.map((row) => ({
            ...row,
            category: row.category as CategoryMismatchView['category'],
        }));
    }
}
