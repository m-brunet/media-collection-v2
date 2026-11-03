import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import BetterSqlite3 from 'better-sqlite3';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { KyselyUserRepository } from '../../apps/server/src/identity/infrastructure/adapters/driven/persistence/kysely-user.repository.js';
import { SeedAdministrator } from '../../apps/server/src/identity/application/use-cases/seed-administrator.usecase.js';
import { User } from '../../apps/server/src/identity/domain/entities/user.entity.js';
import { KyselyHttpSettingsRepository } from '../../apps/server/src/server-settings/infrastructure/adapters/driven/persistence/kysely-http-settings.repository.js';
import { HttpSettings } from '../../apps/server/src/server-settings/domain/value-objects/http-settings.value-object.js';

const paths: string[] = [];
const databases: Database[] = [];

afterEach(async () => {
    try {
        for (const database of databases.splice(0)) {
            await database.close();
        }
    } finally {
        for (const path of paths.splice(0)) {
            await rm(path, { recursive: true, force: true });
        }
    }
});

async function open(directory?: string) {
    const path = directory ?? (await mkdtemp(join(tmpdir(), 'electron-sqlite-')));

    if (!paths.includes(path)) {
        paths.push(path);
    }

    const database = await Database.open(path);

    databases.push(database);

    return {
        database,
        path,
        users: new KyselyUserRepository(database.connection),
    };
}

async function reopen(current: Awaited<ReturnType<typeof open>>) {
    await current.database.close();
    databases.splice(databases.indexOf(current.database), 1);

    return open(current.path);
}

const timestamp = '2026-01-01T00:00:00.000Z';

it('defaults HTTP settings for an existing database without an HTTP record', async () => {
    const current = await open();
    const repository = new KyselyHttpSettingsRepository(current.database.connection);

    const settings = await repository.read();

    expect(settings.snapshot()).toEqual({ port: 34345 });
    expect(
        await current.database.connection.selectFrom('server_settings').selectAll().execute(),
    ).toEqual([]);
});

it('persists the external web port across database reopen', async () => {
    const current = await open();

    await new KyselyHttpSettingsRepository(current.database.connection).save(
        new HttpSettings(36000),
    );

    const restarted = await reopen(current);

    expect(
        (await new KyselyHttpSettingsRepository(restarted.database.connection).read()).snapshot(),
    ).toEqual({
        port: 36000,
    });
});

it('rejects an invalid stored HTTP port before it can be used', async () => {
    const current = await open();
    const repository = new KyselyHttpSettingsRepository(current.database.connection);

    await current.database.connection
        .insertInto('server_settings')
        .values({ name: 'http', value: '{"port":1023}' })
        .execute();

    const result = repository.read();

    await expect(result).rejects.toThrow('1024');
});

it('rejects a stored HTTP port with an invalid shape', async () => {
    const current = await open();
    const repository = new KyselyHttpSettingsRepository(current.database.connection);

    await current.database.connection
        .insertInto('server_settings')
        .values({ name: 'http', value: '{"port":"36000"}' })
        .execute();

    const result = repository.read();

    await expect(result).rejects.toThrow('numeric port');
});

const user = (id: string, username = id) =>
    new User({
        id,
        username,
        role: 'user',
        passwordHash: 'hash',
        mustChangePassword: false,
        language: null,
        tokenVersion: 0,
        createdAt: timestamp,
    });

// Builds a database exactly as the imported foundation left it (migration 001 only, with a Note).
function foundationDatabase(directory: string): void {
    const sqlite = new BetterSqlite3(join(directory, 'application.sqlite'));

    sqlite.exec(`
        create table users (id text primary key, username text not null unique, role text not null,
            password_hash text not null, must_change_password integer not null,
            token_version integer not null, created_at text not null);
        create table notes (id text primary key, owner_id text not null references users(id)
            on delete cascade, title text not null, body text not null, created_at text not null,
            updated_at text not null);
        create index notes_owner on notes (owner_id, updated_at);
        create table server_settings (name text primary key, value text not null);
        create table kysely_migration (name varchar(255) not null primary key,
            timestamp varchar(255) not null);
        create table kysely_migration_lock (id varchar(255) not null primary key,
            is_locked integer default 0 not null);
        insert into kysely_migration values ('001-foundation', '${timestamp}');
        insert into kysely_migration_lock values ('migration_lock', 0);
        insert into users values ('alice', 'alice', 'user', 'hash', 0, 0, '${timestamp}');
        insert into notes values ('n', 'alice', 'Title', 'Body', '${timestamp}', '${timestamp}');
    `);
    sqlite.close();
}

describe('SQLite adapters', () => {
    it('opens a migrated database with WAL, foreign keys, and busy timeout', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'sqlite-options-'));

        paths.push(directory);

        const result = await open(directory);

        expect(
            (
                await sql<{ foreign_keys: number }>`pragma foreign_keys`.execute(
                    result.database.connection,
                )
            ).rows[0]!.foreign_keys,
        ).toBe(1);
        expect(
            (
                await sql<{ journal_mode: string }>`pragma journal_mode`.execute(
                    result.database.connection,
                )
            ).rows[0]!.journal_mode,
        ).toBe('wal');
        expect(
            (
                await sql<{ timeout: number }>`pragma busy_timeout`.execute(
                    result.database.connection,
                )
            ).rows[0]!.timeout,
        ).toBe(5000);
    });

    it('migrates idempotently and preserves accounts on reopen', async () => {
        const current = await open();

        await current.users.create(user('alice'));

        const reopened = await reopen(current);

        expect(await reopened.users.list()).toHaveLength(1);
    });

    it('removes the foundation Notes demo while keeping existing accounts', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'sqlite-foundation-'));

        paths.push(directory);
        foundationDatabase(directory);

        const result = await open(directory);

        const tables = await sql<{
            name: string;
        }>`select name from sqlite_master where type = 'table' and name = 'notes'`.execute(
            result.database.connection,
        );

        expect(tables.rows).toEqual([]);
        expect((await result.users.findById('alice'))!.actor).toMatchObject({
            username: 'alice',
            language: null,
        });
    });

    it('persists the chosen interface language of an account', async () => {
        const current = await open();
        const account = user('alice');

        await current.users.create(account);
        account.chooseLanguage('fr');
        await current.users.save(account, 0);

        const reopened = await reopen(current);

        expect((await reopened.users.findById('alice'))!.actor.language).toBe('fr');
    });

    it('preserves changed credentials when seeding an existing database', async () => {
        const { users } = await open();
        const account = user('administrator', 'admin');

        account.replacePassword('replacement');
        await users.create(account);
        const seed = new SeedAdministrator(
            users,
            { hash: async (value) => 'hash:' + value, matches: async () => false },
            { next: () => 'new' },
            { now: () => new Date(timestamp) },
        );

        await seed.execute();

        expect(await users.list()).toHaveLength(1);
        expect((await users.findByUsername('admin'))!.snapshot.passwordHash).toBe('replacement');
    });

    it('rejects duplicate usernames without creating another account', async () => {
        const { users } = await open();

        await users.create(user('alice'));
        const duplicate = user('third', 'alice');

        const result = users.create(duplicate);

        await expect(result).rejects.toMatchObject({ code: 'conflict' });
        expect(await users.list()).toHaveLength(1);
    });

    it('rejects a stale credential write without overwriting a password reset', async () => {
        const { users } = await open();

        await users.create(user('alice'));
        const stale = (await users.findById('alice'))!;
        const updated = (await users.findById('alice'))!;

        updated.replacePassword('new');
        await users.save(updated, 0);
        stale.rename('renamed');

        const result = users.save(stale, 0);

        await expect(result).rejects.toMatchObject({ code: 'conflict' });
        expect((await users.findById('alice'))!.snapshot).toMatchObject({
            username: 'alice',
            passwordHash: 'new',
        });
    });
});
