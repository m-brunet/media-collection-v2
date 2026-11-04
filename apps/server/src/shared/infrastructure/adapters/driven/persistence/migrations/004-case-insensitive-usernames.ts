import { Kysely, sql } from 'kysely';
import type { Migration } from 'kysely/migration';

export class CaseInsensitiveUsernamesMigration implements Migration {
    async up(db: Kysely<unknown>): Promise<void> {
        await sql`create unique index users_username_case_insensitive
        on users (username collate nocase)`.execute(db);
    }
}
