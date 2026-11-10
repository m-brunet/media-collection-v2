import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';
import { UuidPrimaryKeysMigration } from './006-uuid-primary-keys.js';

// Physical locations (bookcases holding shelves) and reusable tags, each with its own link
// table to books. Deleting a bookcase removes its shelves; deleting a shelf, a tag or a book
// removes only the links, never the books.
export class LocationsAndTagsMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema
            .createTable('bookcases')
            .addColumn('id', 'text', (c) =>
                c.notNull().primaryKey().check(sql.raw(UuidPrimaryKeysMigration.uuidCheck())),
            )
            .addColumn('name', 'text', (c) => c.notNull())
            .addColumn('name_key', 'text', (c) => c.notNull().unique())
            .addColumn('created_at', 'text', (c) => c.notNull())
            .addColumn('updated_at', 'text', (c) => c.notNull())
            .execute();
        await db.schema
            .createTable('shelves')
            .addColumn('id', 'text', (c) =>
                c.notNull().primaryKey().check(sql.raw(UuidPrimaryKeysMigration.uuidCheck())),
            )
            .addColumn('bookcase_id', 'text', (c) =>
                c.notNull().references('bookcases.id').onDelete('cascade'),
            )
            .addColumn('name', 'text', (c) => c.notNull())
            .addColumn('name_key', 'text', (c) => c.notNull())
            .addColumn('created_at', 'text', (c) => c.notNull())
            .addColumn('updated_at', 'text', (c) => c.notNull())
            .addUniqueConstraint('shelves_name_in_bookcase', ['bookcase_id', 'name_key'])
            .execute();
        await db.schema
            .createTable('book_shelves')
            .addColumn('book_id', 'text', (c) =>
                c.notNull().references('books.id').onDelete('cascade'),
            )
            .addColumn('shelf_id', 'text', (c) =>
                c.notNull().references('shelves.id').onDelete('cascade'),
            )
            .addPrimaryKeyConstraint('book_shelves_pk', ['book_id', 'shelf_id'])
            .execute();
        await db.schema
            .createIndex('book_shelves_book')
            .on('book_shelves')
            .column('book_id')
            .unique()
            .execute();
        await db.schema
            .createIndex('book_shelves_shelf')
            .on('book_shelves')
            .column('shelf_id')
            .execute();
        await db.schema
            .createTable('tags')
            .addColumn('id', 'text', (c) =>
                c.notNull().primaryKey().check(sql.raw(UuidPrimaryKeysMigration.uuidCheck())),
            )
            .addColumn('name', 'text', (c) => c.notNull())
            .addColumn('name_key', 'text', (c) => c.notNull().unique())
            .addColumn('created_at', 'text', (c) => c.notNull())
            .addColumn('updated_at', 'text', (c) => c.notNull())
            .execute();
        await db.schema
            .createTable('book_tags')
            .addColumn('book_id', 'text', (c) =>
                c.notNull().references('books.id').onDelete('cascade'),
            )
            .addColumn('tag_id', 'text', (c) =>
                c.notNull().references('tags.id').onDelete('cascade'),
            )
            .addPrimaryKeyConstraint('book_tags_pk', ['book_id', 'tag_id'])
            .execute();
        await db.schema.createIndex('book_tags_tag').on('book_tags').column('tag_id').execute();
    }
}
