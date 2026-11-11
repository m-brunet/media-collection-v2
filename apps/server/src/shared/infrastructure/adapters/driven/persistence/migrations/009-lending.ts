import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';
import { UuidPrimaryKeysMigration } from './006-uuid-primary-keys.js';

export class LendingMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema
            .createTable('receivers')
            .addColumn('id', 'text', (c) =>
                c.notNull().primaryKey().check(sql.raw(UuidPrimaryKeysMigration.uuidCheck())),
            )
            .addColumn('name', 'text', (c) => c.notNull())
            .addColumn('name_key', 'text', (c) => c.notNull().unique())
            .addColumn('created_at', 'text', (c) => c.notNull())
            .execute();
        await db.schema
            .createTable('loans')
            .addColumn('id', 'text', (c) =>
                c.notNull().primaryKey().check(sql.raw(UuidPrimaryKeysMigration.uuidCheck())),
            )
            .addColumn('book_id', 'text', (c) => c.references('books.id').onDelete('set null'))
            .addColumn('receiver_id', 'text', (c) => c.notNull().references('receivers.id'))
            .addColumn('status', 'text', (c) =>
                c.notNull().check(sql`status in ('lent', 'returned')`),
            )
            .addColumn('lent_at', 'text', (c) => c.notNull())
            .addColumn('returned_at', 'text')
            .addColumn('book_title', 'text', (c) => c.notNull())
            .addColumn('book_isbn', 'text')
            .addCheckConstraint(
                'loans_returned_at',
                sql`(status = 'lent' and returned_at is null) or (status = 'returned' and returned_at is not null)`,
            )
            .addCheckConstraint(
                'loans_active_book',
                sql`status = 'returned' or book_id is not null`,
            )
            .execute();
        await db.schema
            .createIndex('loans_active_book_unique')
            .on('loans')
            .column('book_id')
            .unique()
            .where(sql.ref('status'), '=', 'lent')
            .execute();
        await db.schema.createIndex('loans_book').on('loans').column('book_id').execute();
        await db.schema.createIndex('loans_receiver').on('loans').column('receiver_id').execute();
    }
}
