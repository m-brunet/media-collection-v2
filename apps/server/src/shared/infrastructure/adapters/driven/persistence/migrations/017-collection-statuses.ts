import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export class CollectionStatusesMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema
            .alterTable('collections')
            .addColumn('status', 'text', (c) =>
                c
                    .notNull()
                    .defaultTo('unfinished')
                    .check(sql`status in ('unfinished', 'finished', 'dropped')`),
            )
            .execute();
        await sql`update collections set status = 'finished' where finished = 1`.execute(db);
        await db.schema.alterTable('collections').dropColumn('finished').execute();
    }
}
