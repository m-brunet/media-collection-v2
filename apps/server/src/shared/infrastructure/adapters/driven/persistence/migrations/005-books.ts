import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export class BooksMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema
            .createTable('authors')
            .addColumn('id', 'text', (c) => c.primaryKey())
            .addColumn('name', 'text', (c) => c.notNull())
            .addColumn('name_key', 'text', (c) => c.notNull().unique())
            .addColumn('created_at', 'text', (c) => c.notNull())
            .execute();
        await db.schema
            .createTable('books')
            .addColumn('id', 'text', (c) => c.primaryKey())
            .addColumn('title', 'text', (c) => c.notNull())
            .addColumn('title_key', 'text', (c) => c.notNull())
            .addColumn('isbn13', 'text', (c) => c.unique())
            .addColumn('isbn_converted', 'integer', (c) => c.notNull())
            .addColumn('no_isbn', 'integer', (c) => c.notNull())
            .addColumn('category', 'text', (c) => c.notNull())
            .addColumn('ownership', 'text', (c) => c.notNull())
            .addColumn('publisher', 'text')
            .addColumn('publication_year', 'integer')
            .addColumn('publication_month', 'integer')
            .addColumn('summary', 'text')
            .addColumn('page_count', 'integer')
            .addColumn('price_cents', 'integer')
            .addColumn('cover_file', 'text')
            .addColumn('created_at', 'text', (c) => c.notNull())
            .addColumn('updated_at', 'text', (c) => c.notNull())
            .execute();
        await db.schema.createIndex('books_title_key').on('books').column('title_key').execute();
        await db.schema
            .createTable('book_authors')
            .addColumn('book_id', 'text', (c) =>
                c.notNull().references('books.id').onDelete('cascade'),
            )
            .addColumn('author_id', 'text', (c) => c.notNull().references('authors.id'))
            .addColumn('position', 'integer', (c) => c.notNull())
            .addPrimaryKeyConstraint('book_authors_pk', ['book_id', 'author_id'])
            .execute();
        await db.schema
            .createIndex('book_authors_author')
            .on('book_authors')
            .column('author_id')
            .execute();
        await db.schema
            .createTable('reading_statuses')
            .addColumn('user_id', 'text', (c) => c.notNull().references('users.id'))
            .addColumn('book_id', 'text', (c) =>
                c.notNull().references('books.id').onDelete('cascade'),
            )
            .addColumn('read', 'integer', (c) => c.notNull())
            .addPrimaryKeyConstraint('reading_statuses_pk', ['user_id', 'book_id'])
            .execute();
        await db.schema
            .createTable('personal_notes')
            .addColumn('user_id', 'text', (c) => c.notNull().references('users.id'))
            .addColumn('book_id', 'text', (c) =>
                c.notNull().references('books.id').onDelete('cascade'),
            )
            .addColumn('text', 'text', (c) => c.notNull())
            .addColumn('updated_at', 'text', (c) => c.notNull())
            .addPrimaryKeyConstraint('personal_notes_pk', ['user_id', 'book_id'])
            .execute();
    }
}
