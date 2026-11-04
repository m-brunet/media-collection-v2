import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export class FoundationMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema
            .createTable('users')
            .addColumn('id', 'text', (c) => c.primaryKey())
            .addColumn('username', 'text', (c) => c.notNull().unique())
            .addColumn('role', 'text', (c) => c.notNull())
            .addColumn('password_hash', 'text', (c) => c.notNull())
            .addColumn('must_change_password', 'integer', (c) => c.notNull())
            .addColumn('token_version', 'integer', (c) => c.notNull())
            .addColumn('created_at', 'text', (c) => c.notNull())
            .execute();
        await db.schema
            .createTable('notes')
            .addColumn('id', 'text', (c) => c.primaryKey())
            .addColumn('owner_id', 'text', (c) =>
                c.notNull().references('users.id').onDelete('cascade'),
            )
            .addColumn('title', 'text', (c) => c.notNull())
            .addColumn('body', 'text', (c) => c.notNull())
            .addColumn('created_at', 'text', (c) => c.notNull())
            .addColumn('updated_at', 'text', (c) => c.notNull())
            .execute();
        await db.schema
            .createIndex('notes_owner')
            .on('notes')
            .columns(['owner_id', 'updated_at'])
            .execute();
        await db.schema
            .createTable('server_settings')
            .addColumn('name', 'text', (c) => c.primaryKey())
            .addColumn('value', 'text', (c) => c.notNull())
            .execute();
    }
}
