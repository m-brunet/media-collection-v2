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

const now = '2026-01-01T00:00:00.000Z';
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

async function beforeStatuses() {
    const path = await mkdtemp(join(tmpdir(), 'collection-statuses-'));

    paths.push(path);
    const db = new Kysely<unknown>({
        dialect: new SqliteDialect({ database: new BetterSqlite3(join(path, 'app.sqlite')) }),
    });

    connections.push(db);
    const migrator = new Migrator({ db, provider: new DatabaseMigrations(new UuidGenerator()) });
    const result = await migrator.migrateTo('015-kept-covers');

    if (result.error) {
        throw result.error;
    }

    return { db, migrator };
}

async function legacyCollection(db: Kysely<unknown>, name: string, finished: number) {
    const id = randomUUID();

    await sql`insert into collections (id, name, name_key, includes_volume_zero, finished,
        category, created_at, updated_at) values (${id}, ${name}, ${name.toLowerCase()}, 0,
        ${finished}, 'manga', ${now}, ${now})`.execute(db);

    return id;
}

async function statusOf(db: Kysely<unknown>, collectionId: string) {
    const rows = await sql<{ status: string }>`
        select status from collections where id = ${collectionId}`.execute(db);

    return rows.rows[0]?.status;
}

it('keeps a finished collection Finished', async () => {
    const { db, migrator } = await beforeStatuses();
    const akira = await legacyCollection(db, 'Akira', 1);

    await migrator.migrateToLatest();

    expect(await statusOf(db, akira)).toBe('finished');
});

it('keeps an unfinished collection Unfinished', async () => {
    const { db, migrator } = await beforeStatuses();
    const naruto = await legacyCollection(db, 'Naruto', 0);

    await migrator.migrateToLatest();

    expect(await statusOf(db, naruto)).toBe('unfinished');
});

it('removes the former finished mark', async () => {
    const { db, migrator } = await beforeStatuses();

    await migrator.migrateToLatest();

    const columns = await sql<{ name: string }>`
        select name from pragma_table_info('collections')`.execute(db);

    expect(columns.rows.map((column) => column.name)).not.toContain('finished');
});

it('refuses an unknown collection status', async () => {
    const { db, migrator } = await beforeStatuses();
    const naruto = await legacyCollection(db, 'Naruto', 0);

    await migrator.migrateToLatest();

    const operation = sql`update collections set status = 'paused' where id = ${naruto}`.execute(
        db,
    );

    await expect(operation).rejects.toThrow(/CHECK constraint failed/);
});
