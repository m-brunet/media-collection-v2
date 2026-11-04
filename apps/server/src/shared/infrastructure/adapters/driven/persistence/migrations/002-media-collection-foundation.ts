import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export class MediaCollectionFoundationMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema.dropIndex('notes_owner').ifExists().execute();
        await db.schema.dropTable('notes').ifExists().execute();
        await db.schema.alterTable('users').addColumn('language', 'text').execute();
    }
}
