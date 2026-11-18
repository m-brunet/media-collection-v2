import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export class BookcaseSizesMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await db.schema
            .alterTable('bookcases')
            .addColumn('size', 'text', (c) =>
                c
                    .notNull()
                    .defaultTo('large')
                    .check(sql`size in ('large', 'small')`),
            )
            .execute();
    }
}
