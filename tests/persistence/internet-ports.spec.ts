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

async function beforePorts() {
    const path = await mkdtemp(join(tmpdir(), 'internet-ports-'));

    paths.push(path);
    const db = new Kysely<unknown>({
        dialect: new SqliteDialect({ database: new BetterSqlite3(join(path, 'app.sqlite')) }),
    });

    connections.push(db);
    const migrator = new Migrator({ db, provider: new DatabaseMigrations(new UuidGenerator()) });
    const result = await migrator.migrateTo('013-collection-categories');

    if (result.error) {
        throw result.error;
    }

    return { db, migrator };
}

async function saveSetting(db: Kysely<unknown>, name: string, value: object) {
    await sql`insert into server_settings (id, name, value)
        values (${randomUUID()}, ${name}, ${JSON.stringify(value)})`.execute(db);
}

async function setting(db: Kysely<unknown>, name: string): Promise<Record<string, unknown>> {
    const rows = await sql<{ value: string }>`
        select value from server_settings where name = ${name}`.execute(db);

    return JSON.parse(rows.rows[0]?.value ?? '{}') as Record<string, unknown>;
}

it('moves a saved HTTPS port of 3443 to 34443', async () => {
    const { db, migrator } = await beforePorts();

    await saveSetting(db, 'tls', { enabled: true, port: 3443, hasCertificate: true });

    await migrator.migrateToLatest();

    expect(await setting(db, 'tls')).toMatchObject({ enabled: true, port: 34443 });
});

it('keeps another saved HTTPS port', async () => {
    const { db, migrator } = await beforePorts();

    await saveSetting(db, 'tls', { enabled: true, port: 35000, hasCertificate: true });

    await migrator.migrateToLatest();

    expect((await setting(db, 'tls')).port).toBe(35000);
});

it('records the former 443 router rule of an active internet access', async () => {
    const { db, migrator } = await beforePorts();

    await saveSetting(db, 'internet-access', { phase: 'active', mapping: 'upnp' });

    await migrator.migrateToLatest();

    expect(await setting(db, 'internet-access')).toEqual({
        phase: 'active',
        mapping: 'upnp',
        routerPort: 443,
    });
});

it('records no router rule for an internet access that is off', async () => {
    const { db, migrator } = await beforePorts();

    await saveSetting(db, 'internet-access', { phase: 'off' });

    await migrator.migrateToLatest();

    expect(await setting(db, 'internet-access')).toEqual({ phase: 'off' });
});
