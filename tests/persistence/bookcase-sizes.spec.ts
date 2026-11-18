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
    const path = await mkdtemp(join(tmpdir(), 'bookcase-sizes-'));

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

async function insertBookcase(db: Kysely<unknown>, id: string, name: string) {
    await sql`insert into bookcases (id, name, name_key, created_at, updated_at)
        values (${id}, ${name}, ${name.toLowerCase()}, '2026-01-01', '2026-01-01')`.execute(db);
}

async function sizeOf(db: Kysely<unknown>, id: string) {
    const rows = await sql<{ size: string }>`select size from bookcases where id = ${id}`.execute(
        db,
    );

    return rows.rows[0]?.size;
}

it('makes a bookcase from before the update Large', async () => {
    const { db, migrator } = await migratedTo('015-kept-covers');
    const id = randomUUID();

    await insertBookcase(db, id, 'Oak');

    await migrator.migrateToLatest();

    const size = await sizeOf(db, id);

    expect(size).toBe('large');
});
it('makes a bookcase added without a size Large', async () => {
    const { db } = await migratedTo('latest');
    const id = randomUUID();

    await insertBookcase(db, id, 'Oak');

    const size = await sizeOf(db, id);

    expect(size).toBe('large');
});
it('refuses a size other than Large or Small', async () => {
    const { db } = await migratedTo('latest');

    const result = sql`insert into bookcases (id, name, name_key, size, created_at, updated_at)
        values (${randomUUID()}, 'Oak', 'oak', 'medium', '2026-01-01', '2026-01-01')`.execute(db);

    await expect(result).rejects.toThrow();
});
