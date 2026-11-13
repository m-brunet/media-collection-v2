import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { DatabaseMigrations } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database-migrations.adapter.js';

const paths: string[] = [];
const connections: Kysely<unknown>[] = [];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function legacy() {
    const path = await mkdtemp(join(tmpdir(), 'uuid-migration-'));

    paths.push(path);
    const sqlite = new BetterSqlite3(join(path, 'application.sqlite'));

    sqlite.pragma('foreign_keys = ON');
    const db = new Kysely<unknown>({ dialect: new SqliteDialect({ database: sqlite }) });

    connections.push(db);
    const migrator = new Migrator({ db, provider: new DatabaseMigrations(new UuidGenerator()) });
    const result = await migrator.migrateTo('005-books');

    if (result.error) {
        throw result.error;
    }

    return { db, migrator };
}

async function migrated() {
    const current = await legacy();
    const result = await current.migrator.migrateToLatest();

    if (result.error) {
        throw result.error;
    }

    return current.db;
}

it('requires text UUID identities on every single-column application primary key', async () => {
    const db = await migrated();

    const schemas = await sql<{ name: string; sql: string }>`select name, sql from sqlite_master
        where type = 'table' and name not like 'kysely_%' and name not like 'sqlite_%'`.execute(db);

    expect(schemas.rows).toHaveLength(18);

    for (const table of schemas.rows) {
        const columns = await sql<{
            name: string;
            type: string;
            notnull: number;
            pk: number;
        }>`pragma table_info(${sql.id(table.name)})`.execute(db);
        const primary = columns.rows.filter((column) => column.pk > 0);

        if (primary.length === 1) {
            expect(primary[0]).toMatchObject({ name: 'id', type: 'TEXT', notnull: 1 });
            expect(table.sql).toMatch(/check/i);
        } else {
            expect(primary).toHaveLength(2);
        }
    }
});

it('rejects a malformed UUID even when its length and hyphens look correct', async () => {
    const db = await migrated();

    const result = sql`insert into server_settings (id, name, value)
        values ('zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz', 'http', '{}')`.execute(db);

    await expect(result).rejects.toThrow(/CHECK constraint/);
});

it('rejects a null UUID primary key', async () => {
    const db = await migrated();

    const result =
        sql`insert into server_settings (id, name, value) values (null, 'http', '{}')`.execute(db);

    await expect(result).rejects.toThrow(/NOT NULL constraint/);
});

it('rejects a UUID with an invalid version', async () => {
    const db = await migrated();

    const result = sql`insert into server_settings (id, name, value)
        values ('00000000-0000-0000-8000-000000000000', 'http', '{}')`.execute(db);

    await expect(result).rejects.toThrow(/CHECK constraint/);
});

it('keeps setting names unique independently of UUID identities', async () => {
    const db = await migrated();

    await sql`insert into server_settings (id, name, value) values (${randomUUID()}, 'http', '{}')`.execute(
        db,
    );

    const result =
        sql`insert into server_settings (id, name, value) values (${randomUUID()}, 'http', '{}')`.execute(
            db,
        );

    await expect(result).rejects.toThrow(/UNIQUE constraint/);
});

it('preserves populated tables and relationships while upgrading legacy identities', async () => {
    const { db, migrator } = await legacy();
    const user = randomUUID();
    const author = randomUUID();
    const book = randomUUID();

    await sql`insert into users values (${user}, 'alice', 'owner', 'hash', 0, 0, '2026-01-01', 'fr', 1)`.execute(
        db,
    );
    await sql`insert into authors values (${author}, 'An Author', 'an author', '2026-01-01')`.execute(
        db,
    );
    await sql`insert into books (id, title, title_key, isbn_converted, no_isbn, category, ownership, cover_file, created_at, updated_at)
        values (${book}, 'A Book', 'a book', 0, 1, 'books', 'owned', 'cover.png', '2026-01-01', '2026-01-01')`.execute(
        db,
    );
    await sql`insert into book_authors values (${book}, ${author}, 0)`.execute(db);
    await sql`insert into reading_statuses values (${user}, ${book}, 1)`.execute(db);
    await sql`insert into personal_notes values (${user}, ${book}, 'private', '2026-01-01')`.execute(
        db,
    );
    await sql`insert into server_settings values ('http', '{"port":36000}')`.execute(db);
    await sql`insert into audit_logs (operation_id, category, outcome, actor_id, occurred_at, subject_type, subject_id, after_values)
        values (${randomUUID()}, 'book.created', 'successful', ${user}, '2026-01-01', 'book', ${book}, '{"title":"A Book"}')`.execute(
        db,
    );

    const result = await migrator.migrateToLatest();

    expect(result.error).toBeUndefined();
    const users = await sql<{ id: string; language: string }>`select * from users`.execute(db);
    const authors = await sql<{ id: string }>`select * from authors`.execute(db);
    const books = await sql<{ id: string; cover_file: string }>`select * from books`.execute(db);
    const settings = await sql<{
        id: string;
        name: string;
        value: string;
    }>`select * from server_settings`.execute(db);
    const audit = await sql<{
        id: string;
        actor_id: string;
        subject_id: string;
        after_values: string;
    }>`select * from audit_logs`.execute(db);

    expect(users.rows[0]).toMatchObject({ id: user, language: 'fr' });
    expect(authors.rows[0]).toMatchObject({ id: author });
    expect(books.rows[0]).toMatchObject({ id: book, cover_file: 'cover.png' });
    expect(settings.rows[0]).toMatchObject({ name: 'http', value: '{"port":36000}' });
    expect(settings.rows[0]!.id).toMatch(uuid);
    expect(audit.rows[0]).toMatchObject({
        actor_id: user,
        subject_id: book,
        after_values: '{"title":"A Book"}',
    });
    expect(audit.rows[0]!.id).toMatch(uuid);
    expect((await sql`select * from book_authors`.execute(db)).rows).toEqual([
        { book_id: book, author_id: author, position: 0 },
    ]);
    expect((await sql`select * from reading_statuses`.execute(db)).rows).toEqual([
        { user_id: user, book_id: book, read: 1 },
    ]);
    expect((await sql`select * from personal_notes`.execute(db)).rows).toEqual([
        { user_id: user, book_id: book, text: 'private', updated_at: '2026-01-01' },
    ]);
    expect((await sql`pragma foreign_key_check`.execute(db)).rows).toEqual([]);
});

it('rejects invalid legacy IDs without changing existing data or recording the migration', async () => {
    const { db, migrator } = await legacy();

    await sql`insert into users values ('invalid', 'alice', 'owner', 'hash', 0, 0, '2026-01-01', null, 1)`.execute(
        db,
    );
    await sql`insert into server_settings values ('http', '{}')`.execute(db);

    const result = await migrator.migrateToLatest();

    expect(result.error).toBeInstanceOf(Error);
    expect(String(result.error)).toContain('non-UUID primary key');
    expect((await sql`select id from users`.execute(db)).rows).toEqual([{ id: 'invalid' }]);
    expect((await sql`select * from server_settings`.execute(db)).rows).toEqual([
        { name: 'http', value: '{}' },
    ]);
    expect(
        (await sql`select * from kysely_migration where name = '006-uuid-primary-keys'`.execute(db))
            .rows,
    ).toEqual([]);
});

it('rejects non-UUID account identities at the database boundary', async () => {
    const db = await migrated();

    const result =
        sql`insert into users values ('invalid', 'alice', 'owner', 'hash', 0, 0, '2026-01-01', null, 1)`.execute(
            db,
        );

    await expect(result).rejects.toThrow(/CHECK constraint/);
});

it('rejects non-UUID author identities at the database boundary', async () => {
    const db = await migrated();

    const result =
        sql`insert into authors values ('invalid', 'Author', 'author', '2026-01-01')`.execute(db);

    await expect(result).rejects.toThrow(/CHECK constraint/);
});

it('rejects non-UUID book identities at the database boundary', async () => {
    const db = await migrated();

    const result =
        sql`insert into books (id, title, title_key, isbn_converted, no_isbn, category, ownership, created_at, updated_at)
        values ('invalid', 'Book', 'book', 0, 1, 'books', 'owned', '2026-01-01', '2026-01-01')`.execute(
            db,
        );

    await expect(result).rejects.toThrow(/CHECK constraint/);
});

it('rejects non-UUID audit row identities at the database boundary', async () => {
    const db = await migrated();

    const result =
        sql`insert into audit_logs (id, operation_id, category, outcome, occurred_at, subject_type)
        values ('invalid', ${randomUUID()}, 'settings.changed', 'successful', '2026-01-01', 'settings')`.execute(
            db,
        );

    await expect(result).rejects.toThrow(/CHECK constraint/);
});

it('rolls back schema and data if restoring a legacy relationship fails', async () => {
    const { db, migrator } = await legacy();
    const book = randomUUID();
    const author = randomUUID();

    await sql`pragma foreign_keys = off`.execute(db);
    await sql`insert into book_authors values (${book}, ${author}, 0)`.execute(db);
    await sql`pragma foreign_keys = on`.execute(db);
    await sql`insert into server_settings values ('http', '{}')`.execute(db);

    const result = await migrator.migrateToLatest();

    expect(result.error).toBeInstanceOf(Error);
    expect((await sql`select * from server_settings`.execute(db)).rows).toEqual([
        { name: 'http', value: '{}' },
    ]);
    expect((await sql`select * from book_authors`.execute(db)).rows).toEqual([
        { book_id: book, author_id: author, position: 0 },
    ]);
    const schema = await sql<{
        sql: string;
    }>`select sql from sqlite_master where name = 'audit_logs'`.execute(db);

    expect(schema.rows[0]!.sql).toMatch(/integer primary key autoincrement/i);
    expect(
        (await sql`select * from kysely_migration where name = '006-uuid-primary-keys'`.execute(db))
            .rows,
    ).toEqual([]);
});

it('safely retries a committed rebuild whose migration record was not saved', async () => {
    const { db, migrator } = await legacy();
    const initial = await migrator.migrateTo('006-uuid-primary-keys');

    expect(initial.error).toBeUndefined();
    const id = randomUUID();

    await sql`insert into server_settings (id, name, value) values (${id}, 'http', '{}')`.execute(
        db,
    );
    await sql`delete from kysely_migration where name = '006-uuid-primary-keys'`.execute(db);

    const result = await migrator.migrateToLatest();

    expect(result.error).toBeUndefined();
    expect((await sql`select * from server_settings`.execute(db)).rows).toEqual([
        { id, name: 'http', value: '{}' },
    ]);
    expect(
        (
            await sql`select name from kysely_migration where name = '006-uuid-primary-keys'`.execute(
                db,
            )
        ).rows,
    ).toEqual([{ name: '006-uuid-primary-keys' }]);
});

async function withCollection(db: Awaited<ReturnType<typeof migrated>>) {
    const book = randomUUID();
    const collection = randomUUID();

    await sql`insert into books (id, title, title_key, isbn13, isbn_converted, no_isbn, category,
        ownership, created_at, updated_at) values (${book}, 'Year One', 'year one', null, 0, 1,
        'comics', 'owned', '2026-01-01', '2026-01-01')`.execute(db);
    await sql`insert into collections values (${collection}, 'Batman', 'batman', 0, 0,
        '2026-01-01', '2026-01-01')`.execute(db);

    return { book, collection };
}

it('rejects non-UUID collection identities at the database boundary', async () => {
    const db = await migrated();

    const result =
        sql`insert into collections values ('invalid', 'Batman', 'batman', 0, 0, '2026-01-01', '2026-01-01')`.execute(
            db,
        );

    await expect(result).rejects.toThrow(/CHECK constraint/);
});

it('rejects a covered range going downwards', async () => {
    const db = await migrated();
    const { book, collection } = await withCollection(db);

    const result = sql`insert into collection_books values (${book}, ${collection}, 3, 1)`.execute(
        db,
    );

    await expect(result).rejects.toThrow(/CHECK constraint/);
});

it('keeps a book in at most one collection', async () => {
    const db = await migrated();
    const { book, collection } = await withCollection(db);
    const other = randomUUID();

    await sql`insert into collections values (${other}, 'Dune', 'dune', 0, 0,
        '2026-01-01', '2026-01-01')`.execute(db);
    await sql`insert into collection_books values (${book}, ${collection}, 1, 1)`.execute(db);

    const result = sql`insert into collection_books values (${book}, ${other}, 1, 1)`.execute(db);

    await expect(result).rejects.toThrow(/UNIQUE constraint/);
});

it('ends the membership of a deleted book', async () => {
    const db = await migrated();
    const { book, collection } = await withCollection(db);

    await sql`insert into collection_books values (${book}, ${collection}, 1, 1)`.execute(db);

    await sql`delete from books where id = ${book}`.execute(db);

    const rows = await sql`select * from collection_books`.execute(db);

    expect(rows.rows).toEqual([]);
});
