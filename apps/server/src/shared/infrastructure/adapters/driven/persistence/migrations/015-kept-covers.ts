import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';
import { UuidPrimaryKeysMigration } from './006-uuid-primary-keys.js';

export class KeptCoversMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema
            .createTable('kept_covers')
            .addColumn('id', 'text', (c) =>
                c.notNull().primaryKey().check(sql.raw(UuidPrimaryKeysMigration.uuidCheck())),
            )
            .addColumn('isbn13', 'text', (c) => c.notNull().unique())
            .addColumn('file', 'text', (c) => c.notNull())
            .addColumn('kept_at', 'text', (c) => c.notNull())
            .execute();
    }
}
