import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export class CollectionLastVolumesMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema
            .alterTable('collections')
            .addColumn('last_volume', 'integer', (c) =>
                c.check(sql`last_volume is null or (last_volume >= 0 and last_volume <= 9999)`),
            )
            .execute();
    }
}
