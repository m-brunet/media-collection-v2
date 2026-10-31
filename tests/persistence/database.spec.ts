import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { KyselyUserRepository } from '../../apps/server/src/identity/infrastructure/adapters/driven/persistence/kysely-user.repository.js';
import { KyselyNoteRepository } from '../../apps/server/src/notes/infrastructure/adapters/driven/persistence/kysely-note.repository.js';
import { SeedAdministrator } from '../../apps/server/src/identity/application/use-cases/seed-administrator.usecase.js';
import { User } from '../../apps/server/src/identity/domain/entities/user.entity.js';
import { Note } from '../../apps/server/src/notes/domain/entities/note.entity.js';
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
        notes: new KyselyNoteRepository(database.connection),
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

    expect(settings.snapshot()).toEqual({ port: 3000 });
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
        tokenVersion: 0,
        createdAt: timestamp,
    });
const note = (id: string, ownerId: string) =>
    new Note({
        id,
        ownerId,
        title: 'Title',
        body: 'Persisted',
        createdAt: timestamp,
        updatedAt: timestamp,
    });

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

    it('migrates idempotently and preserves accounts and Notes on reopen', async () => {
        const current = await open();

        await current.users.create(user('alice'));
        await current.notes.create(note('saved', 'alice'));

        const reopened = await reopen(current);

        expect(await reopened.users.list()).toHaveLength(1);
        expect((await reopened.notes.find('alice', 'saved'))!.snapshot.body).toBe('Persisted');
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

    it('rejects Notes without an existing owner', async () => {
        const { notes } = await open();
        const orphan = note('orphan', 'absent');

        const result = notes.create(orphan);

        await expect(result).rejects.toThrow(/FOREIGN KEY/);
        expect(await notes.list('absent')).toEqual([]);
    });

    it('scopes note reads to Alice', async () => {
        const owner = 'alice';
        const { users, notes } = await open();

        await users.create(user('alice'));
        await notes.create(note('private', 'alice'));

        const result = await notes.find(owner, 'private');

        expect(result?.snapshot.ownerId ?? null).toBe('alice');
    });
    it('scopes note reads to bobby', async () => {
        const owner = 'bobby';
        const { users, notes } = await open();

        await users.create(user('alice'));
        await notes.create(note('private', 'alice'));

        const result = await notes.find(owner, 'private');

        expect(result?.snapshot.ownerId ?? null).toBe(null);
    });

    it('scopes note lists to Alice', async () => {
        const owner = 'alice';
        const { users, notes } = await open();

        await users.create(user('alice'));
        await notes.create(note('private', 'alice'));

        const result = await notes.list(owner);

        expect(result.map((value) => value.snapshot.id)).toEqual(['private']);
    });
    it('scopes note lists to bobby', async () => {
        const owner = 'bobby';
        const { users, notes } = await open();

        await users.create(user('alice'));
        await notes.create(note('private', 'alice'));

        const result = await notes.list(owner);

        expect(result.map((value) => value.snapshot.id)).toEqual([]);
    });

    it('scopes note updates to Alice', async () => {
        const owner = 'alice';
        const { users, notes } = await open();

        await users.create(user('alice'));
        await users.create(user('bobby'));
        await notes.create(note('private', 'alice'));
        const input = note('private', owner);

        input.edit('Changed', 'Good', timestamp);

        const result = await notes.save(input);

        expect(result).toBe(true);
        expect((await notes.find('alice', 'private'))!.snapshot.title).toBe('Changed');
    });
    it('scopes note updates to bobby', async () => {
        const owner = 'bobby';
        const { users, notes } = await open();

        await users.create(user('alice'));
        await users.create(user('bobby'));
        await notes.create(note('private', 'alice'));
        const input = note('private', owner);

        input.edit('Changed', 'Good', timestamp);

        const result = await notes.save(input);

        expect(result).toBe(false);
        expect((await notes.find('alice', 'private'))!.snapshot.title).toBe('Title');
    });

    it('scopes note deletes to Alice', async () => {
        const owner = 'alice';
        const { users, notes } = await open();

        await users.create(user('alice'));
        await notes.create(note('private', 'alice'));

        const result = await notes.delete(owner, 'private');

        expect(result).toBe(true);
        expect(await notes.find('alice', 'private')).toEqual(null);
    });
    it('scopes note deletes to bobby', async () => {
        const owner = 'bobby';
        const { users, notes } = await open();

        await users.create(user('alice'));
        await notes.create(note('private', 'alice'));

        const result = await notes.delete(owner, 'private');

        expect(result).toBe(false);
        expect(await notes.find('alice', 'private')).toEqual(expect.any(Note));
    });
});
