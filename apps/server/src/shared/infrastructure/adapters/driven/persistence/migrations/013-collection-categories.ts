import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

type CategoryCount = { collection_id: string; category: string; books: number | bigint };

interface CategorySchema {
    collections: { id: string; category: string };
    collection_books: { book_id: string; collection_id: string };
    books: { id: string; category: string };
}

export class CollectionCategoriesMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema
            .alterTable('collections')
            .addColumn('category', 'text', (c) =>
                c
                    .notNull()
                    .defaultTo('books')
                    .check(sql`category in ('books', 'manga', 'comics')`),
            )
            .execute();

        const schema = db as unknown as Kysely<CategorySchema>;
        const counts = await schema
            .selectFrom('collection_books')
            .innerJoin('books', 'books.id', 'collection_books.book_id')
            .select((eb) => [
                'collection_books.collection_id',
                'books.category',
                eb.fn.countAll<number>().as('books'),
            ])
            .groupBy(['collection_books.collection_id', 'books.category'])
            .execute();

        for (const [collectionId, category] of CollectionCategoriesMigration.majorities(counts)) {
            await schema
                .updateTable('collections')
                .set({ category })
                .where('id', '=', collectionId)
                .execute();
        }
    }

    private static majorities(counts: readonly CategoryCount[]): Map<string, string> {
        const best = new Map<string, { category: string; books: number }>();

        for (const count of counts) {
            const books = Number(count.books);
            const current = best.get(count.collection_id);

            if (
                !current ||
                books > current.books ||
                (books === current.books && count.category < current.category)
            ) {
                best.set(count.collection_id, { category: count.category, books });
            }
        }

        return new Map([...best].map(([id, { category }]) => [id, category]));
    }
}
