import type { OrderByDirection, SelectQueryBuilder } from 'kysely';

interface ShelfOrderTables {
    books: { id: string; title_sort_key: string };
    collections: { name_key: string | null };
    collection_books: { volume_from: number | null };
}

export class KyselyShelfOrder {
    static apply<O>(
        query: SelectQueryBuilder<ShelfOrderTables, keyof ShelfOrderTables, O>,
        direction: OrderByDirection = 'asc',
    ): SelectQueryBuilder<ShelfOrderTables, keyof ShelfOrderTables, O> {
        return query
            .orderBy(
                (eb) => eb.fn.coalesce('collections.name_key', 'books.title_sort_key'),
                direction,
            )
            .orderBy((eb) => eb.fn.coalesce('collection_books.volume_from', eb.val(0)), direction)
            .orderBy('books.title_sort_key', direction)
            .orderBy('books.id');
    }
}
