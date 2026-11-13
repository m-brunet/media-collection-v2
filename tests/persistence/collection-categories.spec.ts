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

async function beforeCategories() {
    const path = await mkdtemp(join(tmpdir(), 'collection-categories-'));

    paths.push(path);
    const sqlite = new BetterSqlite3(join(path, 'application.sqlite'));

    sqlite.pragma('foreign_keys = ON');
    const db = new Kysely<unknown>({ dialect: new SqliteDialect({ database: sqlite }) });

    connections.push(db);
    const migrator = new Migrator({ db, provider: new DatabaseMigrations(new UuidGenerator()) });
    const result = await migrator.migrateTo('012-pairing-codes');

    if (result.error) {
        throw result.error;
    }

    return { db, migrator };
}

async function legacyCollection(db: Kysely<unknown>, name: string, categories: string[]) {
    const id = randomUUID();

    await sql`insert into collections (id, name, name_key, includes_volume_zero, finished,
        created_at, updated_at) values (${id}, ${name}, ${name.toLowerCase()}, 0, 0, ${now},
        ${now})`.execute(db);

    for (const [index, category] of categories.entries()) {
        const bookId = randomUUID();

        await sql`insert into books (id, title, title_key, isbn13, isbn_converted, no_isbn,
            category, ownership, created_at, updated_at) values (${bookId},
            ${name + ' ' + index}, ${bookId}, null, 0, 1, ${category}, 'owned', ${now},
            ${now})`.execute(db);
        await sql`insert into collection_books (book_id, collection_id, volume_from, volume_to)
            values (${bookId}, ${id}, ${index + 1}, ${index + 1})`.execute(db);
    }

    return id;
}

async function categoryOf(db: Kysely<unknown>, collectionId: string) {
    const rows = await sql<{ category: string }>`
        select category from collections where id = ${collectionId}`.execute(db);

    return rows.rows[0]?.category;
}

it('gives a collection the category most of its books have', async () => {
    const { db, migrator } = await beforeCategories();
    const naruto = await legacyCollection(db, 'Naruto', ['manga', 'books', 'manga']);

    await migrator.migrateToLatest();

    expect(await categoryOf(db, naruto)).toBe('manga');
});

it('settles a tie with Books, then Comics, then Manga', async () => {
    const { db, migrator } = await beforeCategories();
    const tied = await legacyCollection(db, 'Tied', ['manga', 'comics']);

    await migrator.migrateToLatest();

    expect(await categoryOf(db, tied)).toBe('comics');
});

it('gives an empty collection the Books category', async () => {
    const { db, migrator } = await beforeCategories();
    const empty = await legacyCollection(db, 'Empty', []);

    await migrator.migrateToLatest();

    expect(await categoryOf(db, empty)).toBe('books');
});

it('leaves the books of another category unchanged', async () => {
    const { db, migrator } = await beforeCategories();

    await legacyCollection(db, 'Naruto', ['manga', 'books', 'manga']);

    await migrator.migrateToLatest();

    const books = await sql<{ category: string }>`
        select category from books order by title`.execute(db);

    expect(books.rows.map((book) => book.category)).toEqual(['manga', 'books', 'manga']);
});

it('refuses an unknown collection category', async () => {
    const { db, migrator } = await beforeCategories();
    const naruto = await legacyCollection(db, 'Naruto', ['manga']);

    await migrator.migrateToLatest();

    const operation = sql`update collections set category = 'films' where id = ${naruto}`.execute(
        db,
    );

    await expect(operation).rejects.toThrow(/CHECK constraint/);
});
