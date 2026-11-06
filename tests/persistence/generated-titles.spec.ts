import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import { Book } from '../../apps/server/src/books/domain/entities/book.entity.js';
import type { BookDetails } from '../../apps/server/src/books/domain/entities/book.entity.js';
import { KyselyBookCatalog } from '../../apps/server/src/books/infrastructure/adapters/driven/persistence/kysely-book-catalog.adapter.js';
import { KyselyBookRepository } from '../../apps/server/src/books/infrastructure/adapters/driven/persistence/kysely-book.repository.js';
import { BookFilter } from '../../apps/server/src/shared/application/book-filter.js';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { DatabaseMigrations } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database-migrations.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';

const now = '2026-01-01T00:00:00.000Z';
const paths: string[] = [];
const databases: Database[] = [];
const connections: Kysely<unknown>[] = [];

afterEach(async () => {
    try {
        for (const database of databases.splice(0)) {
            await database.close();
        }

        for (const db of connections.splice(0)) {
            await db.destroy();
        }
    } finally {
        for (const path of paths.splice(0)) {
            await rm(path, { recursive: true, force: true });
        }
    }
});

async function migratedTo(target: string) {
    const path = await mkdtemp(join(tmpdir(), 'titles-upgrade-'));

    paths.push(path);
    const sqlite = new BetterSqlite3(join(path, 'application.sqlite'));

    sqlite.pragma('foreign_keys = ON');
    const db = new Kysely<unknown>({ dialect: new SqliteDialect({ database: sqlite }) });

    connections.push(db);
    const migrator = new Migrator({ db, provider: new DatabaseMigrations(new UuidGenerator()) });
    const result = await migrator.migrateTo(target);

    if (result.error) {
        throw result.error;
    }

    return { db, migrator };
}

async function legacyBook(db: Kysely<unknown>, title: string, titleKey: string) {
    const id = randomUUID();

    await sql`insert into books (id, title, title_key, isbn13, isbn_converted, no_isbn, category,
        ownership, created_at, updated_at) values (${id}, ${title}, ${titleKey}, null, 0, 1,
        'manga', 'owned', ${now}, ${now})`.execute(db);

    return id;
}

// A migrated library whose books are saved through the books repository.
async function library() {
    const path = await mkdtemp(join(tmpdir(), 'titles-'));

    paths.push(path);
    const database = await Database.open(path, new UuidGenerator());

    databases.push(database);
    const authorId = randomUUID();

    await database.connection
        .insertInto('authors')
        .values({
            id: authorId,
            name: 'Yukito Kishiro',
            name_key: 'yukito kishiro',
            created_at: now,
        })
        .execute();
    const books = new KyselyBookRepository(database.connections);
    const catalog = new KyselyBookCatalog(database.connections);
    const save = async (overrides: Partial<BookDetails>) => {
        const book = new Book({
            id: randomUUID(),
            details: {
                title: 'Untitled',
                titleGenerated: false,
                isbn: null,
                noIsbn: true,
                authorIds: [authorId],
                category: 'manga',
                ownership: 'owned',
                publisher: null,
                publicationDate: null,
                summary: null,
                pageCount: null,
                price: null,
                ...overrides,
            },
            coverFile: null,
            createdAt: now,
            updatedAt: now,
        });

        await books.create(book);

        return book;
    };

    return { database, books, catalog, save };
}

describe('migration 010', () => {
    it('keeps every existing title as supplied, even one that looks generated', async () => {
        const { db, migrator } = await migratedTo('009-lending');
        const id = await legacyBook(db, 'Gunnm - 3', 'gunnm - 3');

        const result = await migrator.migrateToLatest();

        expect(result.error).toBeUndefined();
        expect(
            (await sql`select title, title_generated from books where id = ${id}`.execute(db)).rows,
        ).toEqual([{ title: 'Gunnm - 3', title_generated: 0 }]);
    });
    it('gives existing books a title order that compares numbers by value', async () => {
        const { db, migrator } = await migratedTo('009-lending');
        const id = await legacyBook(db, 'Gunnm - 10', 'gunnm - 10');

        await migrator.migrateToLatest();

        expect(
            (await sql`select title_sort_key from books where id = ${id}`.execute(db)).rows,
        ).toEqual([{ title_sort_key: 'gunnm - 0000000010' }]);
    });
    it('refuses a provenance flag other than 0 or 1', async () => {
        const { db, migrator } = await migratedTo('009-lending');
        const id = await legacyBook(db, 'Gunnm - 3', 'gunnm - 3');

        await migrator.migrateToLatest();

        const result = sql`update books set title_generated = 2 where id = ${id}`.execute(db);

        await expect(result).rejects.toThrow(/CHECK constraint/);
    });
});

describe('generated titles in storage', () => {
    it('keeps the provenance of a generated title', async () => {
        const { books, save } = await library();
        const saved = await save({ title: 'Gunnm Vol. 3', titleGenerated: true });

        const result = await books.findById(saved.id);

        expect(result?.details).toMatchObject({ title: 'Gunnm Vol. 3', titleGenerated: true });
    });
    it('lists titles in natural order, numbers compared by value', async () => {
        const { catalog, save } = await library();

        await save({ title: 'Gunnm Vol. 10' });
        await save({ title: 'Gunnm Vol. 2' });
        await save({ title: 'Gunnm Vol. 1' });

        const result = await catalog.search({
            search: '',
            sort: 'title',
            direction: 'asc',
            offset: 0,
            limit: 48,
            readerId: null,
            filter: BookFilter.of({}),
        });

        expect(result.items.map((item) => item.title)).toEqual([
            'Gunnm Vol. 1',
            'Gunnm Vol. 2',
            'Gunnm Vol. 10',
        ]);
    });
});
