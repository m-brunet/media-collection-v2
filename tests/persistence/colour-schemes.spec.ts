import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import { DatabaseMigrations } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database-migrations.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';

const paths: string[] = [];
const connections: Kysely<unknown>[] = [];

afterEach(async () => {
    try {
        for (const db of connections.splice(0)) {
            await db.destroy();
        }
    } finally {
        for (const path of paths.splice(0)) {
            await rm(path, { recursive: true, force: true });
        }
    }
});

// A database just before KI-6, with a saved colour scheme.
async function savedBeforeNewSchemes(colorScheme: string) {
    const path = await mkdtemp(join(tmpdir(), 'colour-schemes-'));

    paths.push(path);
    const db = new Kysely<unknown>({
        dialect: new SqliteDialect({
            database: new BetterSqlite3(join(path, 'application.sqlite')),
        }),
    });

    connections.push(db);
    const migrator = new Migrator({ db, provider: new DatabaseMigrations(new UuidGenerator()) });
    const before = await migrator.migrateTo('010-generated-titles');

    if (before.error) {
        throw before.error;
    }

    await sql`insert into server_settings (id, name, value)
        values (${randomUUID()}, 'appearance', ${JSON.stringify({ colorScheme })})`.execute(db);

    return { db, migrator };
}

async function savedScheme(db: Kysely<unknown>) {
    const row = await sql<{ value: string }>`
        select value from server_settings where name = 'appearance'`.execute(db);

    return JSON.parse(row.rows[0]!.value).colorScheme as string;
}

it('switches a saved Mint scheme to Spring green', async () => {
    const { db, migrator } = await savedBeforeNewSchemes('mint');

    await migrator.migrateToLatest();

    expect(await savedScheme(db)).toBe('spring-green');
});
it('switches a saved Emerald scheme to Spring green', async () => {
    const { db, migrator } = await savedBeforeNewSchemes('emerald');

    await migrator.migrateToLatest();

    expect(await savedScheme(db)).toBe('spring-green');
});
it('switches a saved Forest scheme to Spring green', async () => {
    const { db, migrator } = await savedBeforeNewSchemes('forest');

    await migrator.migrateToLatest();

    expect(await savedScheme(db)).toBe('spring-green');
});
it('keeps a saved Spring green scheme', async () => {
    const { db, migrator } = await savedBeforeNewSchemes('spring-green');

    await migrator.migrateToLatest();

    expect(await savedScheme(db)).toBe('spring-green');
});
