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

async function migratedTo(name: string) {
    const path = await mkdtemp(join(tmpdir(), 'collection-last-volumes-'));

    paths.push(path);
    const db = new Kysely<unknown>({
        dialect: new SqliteDialect({
            database: new BetterSqlite3(join(path, 'application.sqlite')),
        }),
    });

    connections.push(db);
    const migrator = new Migrator({ db, provider: new DatabaseMigrations(new UuidGenerator()) });
    const result =
        name === 'latest' ? await migrator.migrateToLatest() : await migrator.migrateTo(name);

    if (result.error) {
        throw result.error;
    }

    return { db, migrator };
}

async function insertCollection(db: Kysely<unknown>, id: string) {
    await sql`insert into collections (id, name, name_key, category, includes_volume_zero, created_at, updated_at)
        values (${id}, 'Batman', 'batman', 'comics', 0, '2026-01-01', '2026-01-01')`.execute(db);
}

it('leaves a collection from before the update without a last volume', async () => {
    const { db, migrator } = await migratedTo('017-collection-statuses');
    const id = randomUUID();

    await insertCollection(db, id);

    await migrator.migrateToLatest();

    const rows = await sql<{ last_volume: number | null }>`
        select last_volume from collections where id = ${id}`.execute(db);

    expect(rows.rows[0]?.last_volume).toBeNull();
});
it('refuses a last volume past 9999', async () => {
    const { db } = await migratedTo('latest');
    const id = randomUUID();

    await insertCollection(db, id);

    const update = sql`update collections set last_volume = 10000 where id = ${id}`.execute(db);

    await expect(update).rejects.toThrow(/CHECK constraint failed/);
});
