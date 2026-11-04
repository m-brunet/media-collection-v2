import { Kysely, sql } from 'kysely';
import type { Migration } from 'kysely/migration';

export class AccessAndAuditMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await sql`update users set role = 'owner' where role = 'user'`.execute(db);
        await sql`update users set role = 'owner' where role = 'admin' and id <> (
        select id from users where role = 'admin' order by created_at, id limit 1
    )`.execute(db);
        await db.schema
            .alterTable('users')
            .addColumn('active', 'integer', (c) => c.notNull().defaultTo(1))
            .execute();
        await sql`create unique index users_single_administrator on users (role)
        where role = 'admin'`.execute(db);
        await db.schema
            .createTable('audit_logs')
            .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
            .addColumn('operation_id', 'text', (c) => c.notNull())
            .addColumn('category', 'text', (c) => c.notNull())
            .addColumn('outcome', 'text', (c) => c.notNull())
            .addColumn('actor_id', 'text', (c) => c.references('users.id'))
            .addColumn('occurred_at', 'text', (c) => c.notNull())
            .addColumn('subject_type', 'text', (c) => c.notNull())
            .addColumn('subject_id', 'text')
            .addColumn('before_values', 'text')
            .addColumn('after_values', 'text')
            .addColumn('failure', 'text')
            .execute();
        await db.schema
            .createIndex('audit_logs_occurred')
            .on('audit_logs')
            .columns(['occurred_at', 'id'])
            .execute();
        await db.schema
            .createIndex('audit_logs_operation')
            .on('audit_logs')
            .column('operation_id')
            .execute();
    }
}
