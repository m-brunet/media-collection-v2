import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export class GeneratedTitlesMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema
            .alterTable('books')
            .addColumn('title_generated', 'integer', (c) =>
                c
                    .notNull()
                    .defaultTo(0)
                    .check(sql`title_generated in (0, 1)`),
            )
            .execute();
        await db.schema
            .alterTable('books')
            .addColumn('title_sort_key', 'text', (c) => c.notNull().defaultTo(''))
            .execute();

        const books = await sql<{ id: string; title_key: string }>`
            select id, title_key from books`.execute(db);

        for (const book of books.rows) {
            await sql`update books set title_sort_key = ${GeneratedTitlesMigration.sortKey(
                book.title_key,
            )} where id = ${book.id}`.execute(db);
        }

        await db.schema
            .createIndex('books_title_sort_key')
            .on('books')
            .column('title_sort_key')
            .execute();
    }

    private static sortKey(titleKey: string): string {
        return titleKey.replace(/\d+/g, (digits) => digits.padStart(10, '0'));
    }
}
