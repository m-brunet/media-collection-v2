import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';
import { UuidPrimaryKeysMigration } from './006-uuid-primary-keys.js';

export class CollectionsMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema
            .createTable('collections')
            .addColumn('id', 'text', (c) =>
                c.notNull().primaryKey().check(sql.raw(UuidPrimaryKeysMigration.uuidCheck())),
            )
            .addColumn('name', 'text', (c) => c.notNull())
            .addColumn('name_key', 'text', (c) => c.notNull().unique())
            .addColumn('includes_volume_zero', 'integer', (c) => c.notNull())
            .addColumn('finished', 'integer', (c) => c.notNull())
            .addColumn('created_at', 'text', (c) => c.notNull())
            .addColumn('updated_at', 'text', (c) => c.notNull())
            .execute();
        await db.schema
            .createTable('collection_books')
            .addColumn('book_id', 'text', (c) =>
                c.notNull().references('books.id').onDelete('cascade'),
            )
            .addColumn('collection_id', 'text', (c) =>
                c.notNull().references('collections.id').onDelete('cascade'),
            )
            .addColumn('volume_from', 'integer', (c) => c.notNull().check(sql`volume_from >= 0`))
            .addColumn('volume_to', 'integer', (c) => c.notNull().check(sql`volume_to <= 9999`))
            .addPrimaryKeyConstraint('collection_books_pk', ['book_id', 'collection_id'])
            .addCheckConstraint('collection_books_range', sql`volume_to >= volume_from`)
            .execute();
        await db.schema
            .createIndex('collection_books_book')
            .on('collection_books')
            .column('book_id')
            .unique()
            .execute();
        await db.schema
            .createIndex('collection_books_collection')
            .on('collection_books')
            .column('collection_id')
            .execute();
    }
}
