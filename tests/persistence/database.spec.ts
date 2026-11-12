import { createHash, randomUUID } from 'node:crypto';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import BetterSqlite3 from 'better-sqlite3';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { KyselyUserRepository } from '../../apps/server/src/identity/infrastructure/adapters/driven/persistence/kysely-user.repository.js';
import { KyselyAppearanceRepository } from '../../apps/server/src/appearance/infrastructure/adapters/driven/persistence/kysely-appearance.repository.js';
import { ColorScheme } from '../../apps/server/src/appearance/domain/value-objects/color-scheme.value-object.js';
import { KyselyAuditTrail } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/kysely-audit-trail.adapter.js';
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

    const database = await Database.open(path, new UuidGenerator());

    databases.push(database);

    return {
        database,
        path,
        users: new KyselyUserRepository(database.connections),
    };
}

async function reopen(current: Awaited<ReturnType<typeof open>>) {
    await current.database.close();
    databases.splice(databases.indexOf(current.database), 1);

    return open(current.path);
}

const testId = (name: string) => {
    const hex = createHash('sha256').update(name).digest('hex');

    return (
        hex.slice(0, 8) +
        '-' +
        hex.slice(8, 12) +
        '-4' +
        hex.slice(13, 16) +
        '-8' +
        hex.slice(17, 20) +
        '-' +
        hex.slice(20, 32)
    );
};

const timestamp = '2026-01-01T00:00:00.000Z';

it('defaults HTTP settings for an existing database without an HTTP record', async () => {
    const current = await open();
    const repository = new KyselyHttpSettingsRepository(
        current.database.connections,
        new UuidGenerator(),
    );

    const settings = await repository.read();

    expect(settings.snapshot()).toEqual({ port: 34345 });
    expect(
        await current.database.connection.selectFrom('server_settings').selectAll().execute(),
    ).toEqual([]);
});

it('defaults HTTP settings to the port it is given when nothing was saved', async () => {
    const current = await open();
    const repository = new KyselyHttpSettingsRepository(
        current.database.connections,
        new UuidGenerator(),
        34346,
    );

    const settings = await repository.read();

    expect(settings.snapshot()).toEqual({ port: 34346 });
});

it('persists the external web port across database reopen', async () => {
    const current = await open();

    await new KyselyHttpSettingsRepository(current.database.connections, new UuidGenerator()).save(
        new HttpSettings(36000),
    );

    const restarted = await reopen(current);

    expect(
        (
            await new KyselyHttpSettingsRepository(
                restarted.database.connections,
                new UuidGenerator(),
            ).read()
        ).snapshot(),
    ).toEqual({
        port: 36000,
    });
});

it('rejects an invalid stored HTTP port before it can be used', async () => {
    const current = await open();
    const repository = new KyselyHttpSettingsRepository(
        current.database.connections,
        new UuidGenerator(),
    );

    await current.database.connection
        .insertInto('server_settings')
        .values({ id: randomUUID(), name: 'http', value: '{"port":1023}' })
        .execute();

    const result = repository.read();

    await expect(result).rejects.toThrow('1024');
});

it('rejects a stored HTTP port with an invalid shape', async () => {
    const current = await open();
    const repository = new KyselyHttpSettingsRepository(
        current.database.connections,
        new UuidGenerator(),
    );

    await current.database.connection
        .insertInto('server_settings')
        .values({ id: randomUUID(), name: 'http', value: '{"port":"36000"}' })
        .execute();

    const result = repository.read();

    await expect(result).rejects.toThrow('numeric port');
});

const user = (id: string, username = id, role: 'admin' | 'owner' | 'guest' = 'owner') =>
    new User({
        id: testId(id),
        username,
        role,
        passwordHash: 'hash',
        mustChangePassword: false,
        language: null,
        tokenVersion: 0,
        createdAt: timestamp,
        active: true,
    });

function foundationDatabase(
    directory: string,
    accounts: [string, string, string][] = [['alice', 'user', timestamp]],
): void {
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
    `);

    for (const [id, role, created] of accounts) {
        sqlite
            .prepare('insert into users values (?, ?, ?, ?, 0, 0, ?)')
            .run(testId(id), id, role, 'hash', created);
    }

    sqlite
        .prepare('insert into notes values (?, ?, ?, ?, ?, ?)')
        .run('n', testId(accounts[0]![0]), 'Title', 'Body', timestamp, timestamp);
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
        expect((await result.users.findById(testId('alice')))!.actor).toMatchObject({
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

        expect((await reopened.users.findById(testId('alice')))!.actor.language).toBe('fr');
    });

    it('reads Spring green when no colour scheme was saved', async () => {
        const { database } = await open();
        const repository = new KyselyAppearanceRepository(
            database.connections,
            new UuidGenerator(),
        );

        const result = await repository.read();

        expect(result.name).toBe('spring-green');
    });

    it('persists the chosen colour scheme across reopen', async () => {
        const current = await open();

        await new KyselyAppearanceRepository(
            current.database.connections,
            new UuidGenerator(),
        ).save(new ColorScheme('ember'));

        const reopened = await reopen(current);

        expect(
            (
                await new KyselyAppearanceRepository(
                    reopened.database.connections,
                    new UuidGenerator(),
                ).read()
            ).name,
        ).toBe('ember');
    });

    it('rejects an unknown stored colour scheme', async () => {
        const { database } = await open();

        await database.connection
            .insertInto('server_settings')
            .values({ id: randomUUID(), name: 'appearance', value: '{"colorScheme":"purple"}' })
            .execute();

        const result = new KyselyAppearanceRepository(
            database.connections,
            new UuidGenerator(),
        ).read();

        await expect(result).rejects.toMatchObject({ reason: 'color-scheme-unknown' });
    });

    it('keeps the letter case of a username', async () => {
        const { users } = await open();

        await users.create(user('alice', 'Alice'));

        const result = await users.findByUsername('Alice');

        expect(result?.actor.username).toBe('Alice');
    });

    it('does not find a username spelled with another letter case', async () => {
        const { users } = await open();

        await users.create(user('alice', 'Alice'));

        const result = await users.findByUsername('alice');

        expect(result).toBeNull();
    });

    it('rejects a username differing from another only by letter case', async () => {
        const { users } = await open();

        await users.create(user('alice', 'Alice'));

        const result = users.create(user('second', 'ALICE'));

        await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'username-taken' });
        expect(await users.list()).toHaveLength(1);
    });

    it('lets an account change only the letter case of its own username', async () => {
        const { users } = await open();
        const account = user('alice', 'alice');

        await users.create(account);
        account.rename('Alice');

        await users.save(account, 0);

        expect((await users.findById(testId('alice')))!.actor.username).toBe('Alice');
    });

    it('allows only one administrator', async () => {
        const { users } = await open();

        await users.create(user('first', 'first', 'admin'));

        const result = users.create(user('second', 'second', 'admin'));

        await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'setup-completed' });
        expect(await users.list()).toHaveLength(1);
    });

    it('persists a deactivated account', async () => {
        const current = await open();
        const account = user('robin');

        await current.users.create(account);
        account.deactivate();
        await current.users.save(account, 0);

        const reopened = await reopen(current);

        expect((await reopened.users.findById(testId('robin')))!.summary).toMatchObject({
            active: false,
            role: 'owner',
        });
    });

    it('commits every change of a successful transaction', async () => {
        const { database, users } = await open();

        await database.connections.run(async () => {
            await users.create(user('alice'));
            await users.create(user('bobby'));
        });

        expect(await users.list()).toHaveLength(2);
    });

    it('rolls back every change of a failed transaction', async () => {
        const { database, users } = await open();

        const result = database.connections.run(async () => {
            await users.create(user('alice'));
            throw new Error('Second step failed');
        });

        await expect(result).rejects.toThrow('Second step failed');
        expect(await users.list()).toEqual([]);
    });

    it('stores audit entries without credential values', async () => {
        const { database, users } = await open();
        const audit = new KyselyAuditTrail(database.connections, new UuidGenerator());

        await users.create(user('alice'));

        await audit.record({
            operationId: 'operation',
            category: 'account.created',
            outcome: 'successful',
            actorId: testId('alice'),
            occurredAt: timestamp,
            subjectType: 'account',
            subjectId: 'alice',
            before: null,
            after: {
                username: 'alice',
                password: 'secret-1',
                nested: { passwordHash: 'secret-2' },
            },
            failure: null,
        });

        const stored = JSON.stringify(
            await database.connection.selectFrom('audit_logs').selectAll().execute(),
        );

        expect(stored).toContain('alice');
        expect(stored).not.toContain('secret-1');
        expect(stored).not.toContain('secret-2');
    });

    it('keeps an audit entry written after a rolled-back transaction', async () => {
        const { database } = await open();
        const audit = new KyselyAuditTrail(database.connections, new UuidGenerator());
        const entry = {
            operationId: 'operation',
            category: 'account.created',
            outcome: 'failed' as const,
            actorId: null,
            occurredAt: timestamp,
            subjectType: 'account',
            subjectId: null,
            before: null,
            after: null,
            failure: 'conflict',
        };

        await database.connections
            .run(async () => {
                await audit.record({ ...entry, outcome: 'successful' });
                throw new Error('Rolled back');
            })
            .catch(() => undefined);
        await audit.record(entry);

        const rows = await database.connection.selectFrom('audit_logs').select('outcome').execute();

        expect(rows).toEqual([{ outcome: 'failed' }]);
    });

    it('converts foundation roles: one administrator, other accounts become Owners', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'sqlite-roles-'));

        paths.push(directory);
        foundationDatabase(directory, [
            ['first', 'admin', '2026-01-01'],
            ['later', 'admin', '2026-02-01'],
            ['member', 'user', '2026-03-01'],
        ]);

        const { users } = await open(directory);

        expect((await users.list()).map((account) => account.summary.role)).toEqual([
            'admin',
            'owner',
            'owner',
        ]);
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
        const stale = (await users.findById(testId('alice')))!;
        const updated = (await users.findById(testId('alice')))!;

        updated.replacePassword('new');
        await users.save(updated, 0);
        stale.rename('renamed');

        const result = users.save(stale, 0);

        await expect(result).rejects.toMatchObject({ code: 'conflict' });
        expect((await users.findById(testId('alice')))!.snapshot).toMatchObject({
            username: 'alice',
            passwordHash: 'new',
        });
    });
});

describe('database checks for local maintenance', () => {
    it('reports a migrated database as up to date', async () => {
        const { database } = await open();

        const result = await database.isUpToDate(new UuidGenerator());

        expect(result).toBe(true);
    });
    it('reports a database missing migrations as not up to date', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'electron-sqlite-'));

        paths.push(directory);
        const sqlite = new BetterSqlite3(join(directory, 'application.sqlite'));

        sqlite.exec('CREATE TABLE users (id TEXT)');
        sqlite.close();
        const database = Database.openExisting(directory);

        databases.push(database);

        const result = await database.isUpToDate(new UuidGenerator());

        expect(result).toBe(false);
    });
    it('releases a file that is not a database', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'electron-sqlite-'));

        paths.push(directory);
        const file = join(directory, 'application.sqlite');

        await writeFile(file, 'not a database');

        const open = () => Database.openExisting(directory);

        expect(open).toThrow();
        await expect(unlink(file)).resolves.toBeUndefined();
    });
});
