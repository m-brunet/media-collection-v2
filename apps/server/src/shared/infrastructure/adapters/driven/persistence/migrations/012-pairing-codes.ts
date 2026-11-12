import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';
import { UuidPrimaryKeysMigration } from './006-uuid-primary-keys.js';

export class PairingCodesMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema
            .createTable('pairing_codes')
            .addColumn('id', 'text', (c) =>
                c.notNull().primaryKey().check(sql.raw(UuidPrimaryKeysMigration.uuidCheck())),
            )
            .addColumn('account_id', 'text', (c) =>
                c.notNull().references('users.id').onDelete('cascade'),
            )
            .addColumn('code_hash', 'text', (c) => c.notNull().unique())
            .addColumn('token_version', 'integer', (c) => c.notNull())
            .addColumn('created_at', 'text', (c) => c.notNull())
            .addColumn('expires_at', 'text', (c) => c.notNull())
            .addColumn('used_at', 'text')
            .execute();
        await db.schema
            .createIndex('pairing_codes_account')
            .on('pairing_codes')
            .column('account_id')
            .execute();
    }
}
