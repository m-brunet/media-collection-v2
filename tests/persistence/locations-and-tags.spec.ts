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

async function migrated(target?: string) {
    const path = await mkdtemp(join(tmpdir(), 'locations-tags-'));

    paths.push(path);
    const sqlite = new BetterSqlite3(join(path, 'application.sqlite'));

    sqlite.pragma('foreign_keys = ON');
    const db = new Kysely<unknown>({ dialect: new SqliteDialect({ database: sqlite }) });

    connections.push(db);
    const migrator = new Migrator({ db, provider: new DatabaseMigrations(new UuidGenerator()) });
    const result = target ? await migrator.migrateTo(target) : await migrator.migrateToLatest();

    if (result.error) {
        throw result.error;
    }

    return { db, migrator };
}

async function book(db: Kysely<unknown>) {
    const id = randomUUID();

    await sql`insert into books (id, title, title_key, isbn13, isbn_converted, no_isbn, category,
        ownership, created_at, updated_at) values (${id}, 'Dune', 'dune', null, 0, 1, 'books',
        'owned', '2026-01-01', '2026-01-01')`.execute(db);

    return id;
}

async function bookcase(db: Kysely<unknown>, name = 'Oak') {
    const id = randomUUID();

    await sql`insert into bookcases values (${id}, ${name}, ${name.toLowerCase()},
        '2026-01-01', '2026-01-01')`.execute(db);

    return id;
}

async function shelf(db: Kysely<unknown>, bookcaseId: string, name = 'Top') {
    const id = randomUUID();

    await sql`insert into shelves values (${id}, ${bookcaseId}, ${name}, ${name.toLowerCase()},
        '2026-01-01', '2026-01-01')`.execute(db);

    return id;
}

async function tag(db: Kysely<unknown>, name = 'Fantasy') {
    const id = randomUUID();

    await sql`insert into tags values (${id}, ${name}, ${name.toLowerCase()},
        '2026-01-01', '2026-01-01')`.execute(db);

    return id;
}

it('rejects non-UUID bookcase, shelf and tag identities', async () => {
    const { db } = await migrated();
    const oak = await bookcase(db);

    const results = [
        sql`insert into bookcases values ('x', 'Hall', 'hall', '2026-01-01', '2026-01-01')`.execute(
            db,
        ),
        sql`insert into shelves values ('x', ${oak}, 'Top', 'top', '2026-01-01', '2026-01-01')`.execute(
            db,
        ),
        sql`insert into tags values ('x', 'Fantasy', 'fantasy', '2026-01-01', '2026-01-01')`.execute(
            db,
        ),
    ];

    for (const result of results) {
        await expect(result).rejects.toThrow(/CHECK constraint/);
    }
});

it('keeps bookcase names unique across the installation', async () => {
    const { db } = await migrated();

    await bookcase(db, 'Oak');

    const result = bookcase(db, 'Oak');

    await expect(result).rejects.toThrow(/UNIQUE constraint/);
});

it('lets two bookcases each contain a shelf with the same name', async () => {
    const { db } = await migrated();
    const oak = await bookcase(db, 'Oak');
    const study = await bookcase(db, 'Study');

    await shelf(db, oak, 'Top');

    const result = shelf(db, study, 'Top');

    await expect(result).resolves.toBeTypeOf('string');
});

it('refuses two equivalent shelf names in one bookcase', async () => {
    const { db } = await migrated();
    const oak = await bookcase(db);

    await shelf(db, oak, 'Top');

    const result = shelf(db, oak, 'Top');

    await expect(result).rejects.toThrow(/UNIQUE constraint/);
});

it('keeps a book on at most one shelf', async () => {
    const { db } = await migrated();
    const oak = await bookcase(db);
    const top = await shelf(db, oak, 'Top');
    const bottom = await shelf(db, oak, 'Bottom');
    const dune = await book(db);

    await sql`insert into book_shelves values (${dune}, ${top})`.execute(db);

    const result = sql`insert into book_shelves values (${dune}, ${bottom})`.execute(db);

    await expect(result).rejects.toThrow(/UNIQUE constraint|PRIMARY KEY/);
});

it('unassigns the books of a deleted bookcase and removes its shelves, keeping the books', async () => {
    const { db } = await migrated();
    const oak = await bookcase(db);
    const top = await shelf(db, oak);
    const dune = await book(db);

    await sql`insert into book_shelves values (${dune}, ${top})`.execute(db);

    await sql`delete from bookcases where id = ${oak}`.execute(db);

    expect((await sql`select * from shelves`.execute(db)).rows).toEqual([]);
    expect((await sql`select * from book_shelves`.execute(db)).rows).toEqual([]);
    expect((await sql`select id from books`.execute(db)).rows).toEqual([{ id: dune }]);
});

it('removes the links of a deleted tag, keeping the books', async () => {
    const { db } = await migrated();
    const fantasy = await tag(db);
    const dune = await book(db);

    await sql`insert into book_tags values (${dune}, ${fantasy})`.execute(db);

    await sql`delete from tags where id = ${fantasy}`.execute(db);

    expect((await sql`select * from book_tags`.execute(db)).rows).toEqual([]);
    expect((await sql`select id from books`.execute(db)).rows).toEqual([{ id: dune }]);
});

it('removes the shelf and tag links of a deleted book, keeping the shelf and tag', async () => {
    const { db } = await migrated();
    const top = await shelf(db, await bookcase(db));
    const fantasy = await tag(db);
    const dune = await book(db);

    await sql`insert into book_shelves values (${dune}, ${top})`.execute(db);
    await sql`insert into book_tags values (${dune}, ${fantasy})`.execute(db);

    await sql`delete from books where id = ${dune}`.execute(db);

    expect((await sql`select * from book_shelves`.execute(db)).rows).toEqual([]);
    expect((await sql`select * from book_tags`.execute(db)).rows).toEqual([]);
    expect((await sql`select count(*) as count from tags`.execute(db)).rows).toEqual([
        { count: 1 },
    ]);
});

it('adds the location and tag tables to a populated library', async () => {
    const { db, migrator } = await migrated('007-collections');
    const dune = await book(db);

    const result = await migrator.migrateToLatest();

    expect(result.error).toBeUndefined();
    expect((await sql`select id from books`.execute(db)).rows).toEqual([{ id: dune }]);
    expect((await sql`select * from book_shelves`.execute(db)).rows).toEqual([]);
});
