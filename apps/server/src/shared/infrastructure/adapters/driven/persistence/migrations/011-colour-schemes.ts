import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

// Mint, Emerald and Forest are no longer offered. An installation that chose one of them
// switches to Spring green, the default, without an error or a prompt.
export class ColourSchemesMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await sql`update server_settings
            set value = json_set(value, '$.colorScheme', 'spring-green')
            where name = 'appearance'
                and json_extract(value, '$.colorScheme') in ('mint', 'emerald', 'forest')`.execute(
            db,
        );
    }
}
