import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { KyselyBookCatalog } from '../../apps/server/src/books/infrastructure/adapters/driven/persistence/kysely-book-catalog.adapter.js';
import { NameKey } from '../../apps/server/src/shared/domain/name-key.helper.js';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';

const now = '2026-01-01T00:00:00.000Z';

export class LibraryRows {
    static readonly paths: string[] = [];
    static readonly databases: Database[] = [];

    static async close(): Promise<void> {
        try {
            for (const database of LibraryRows.databases.splice(0)) {
                await database.close();
            }
        } finally {
            for (const path of LibraryRows.paths.splice(0)) {
                await rm(path, { recursive: true, force: true });
            }
        }
    }
}

export interface ShelvedBook {
    title: string;
    isbn13?: string;
    category?: string;
    ownership?: string;
    author?: string;
    collectionId?: string;
    volume?: number;
    shelfId?: string;
    tagIds?: string[];
    readBy?: string;
    cover?: string;
    priceCents?: number;
    pageCount?: number;
}

export async function library() {
    const path = await mkdtemp(join(tmpdir(), 'catalog-filters-'));

    LibraryRows.paths.push(path);
    const database = await Database.open(path, new UuidGenerator());

    LibraryRows.databases.push(database);
    const db = database.connection;
    const catalog = new KyselyBookCatalog(database.connections);
    const authors = new Map<string, string>();
    const named = async (table: 'bookcases' | 'tags' | 'collections' | 'authors', name: string) => {
        const id = randomUUID();
        const key = NameKey.of(name);

        if (table === 'collections') {
            await db
                .insertInto('collections')
                .values({
                    id,
                    name,
                    name_key: key,
                    category: 'books',
                    includes_volume_zero: 0,
                    finished: 0,
                    created_at: now,
                    updated_at: now,
                })
                .execute();
        } else if (table === 'authors') {
            await db
                .insertInto('authors')
                .values({ id, name, name_key: key, created_at: now })
                .execute();
        } else {
            await db
                .insertInto(table)
                .values({ id, name, name_key: key, created_at: now, updated_at: now })
                .execute();
        }

        return id;
    };
    const author = async (name: string) => {
        const id = await named('authors', name);

        authors.set(name, id);

        return id;
    };

    return {
        connections: database.connections,
        catalog,
        bookcase: (name: string) => named('bookcases', name),
        tag: (name: string) => named('tags', name),
        collection: (name: string) => named('collections', name),
        async shelf(bookcaseId: string, name = 'Top') {
            const id = randomUUID();

            await db
                .insertInto('shelves')
                .values({
                    id,
                    bookcase_id: bookcaseId,
                    name,
                    name_key: NameKey.of(name),
                    created_at: now,
                    updated_at: now,
                })
                .execute();

            return id;
        },
        async reader() {
            const id = randomUUID();

            await db
                .insertInto('users')
                .values({
                    id,
                    username: 'camille-' + id.slice(0, 8),
                    role: 'owner',
                    password_hash: 'hash',
                    must_change_password: 0,
                    token_version: 0,
                    created_at: now,
                    language: null,
                    active: 1,
                })
                .execute();

            return id;
        },
        async book(book: ShelvedBook) {
            const id = randomUUID();

            await db
                .insertInto('books')
                .values({
                    id,
                    title: book.title,
                    title_key: NameKey.of(book.title),
                    title_generated: 0,
                    title_sort_key: NameKey.of(book.title),
                    isbn13: book.isbn13 ?? null,
                    isbn_converted: 0,
                    no_isbn: book.isbn13 ? 0 : 1,
                    category: book.category ?? 'books',
                    ownership: book.ownership ?? 'owned',
                    publisher: null,
                    publication_year: null,
                    publication_month: null,
                    summary: null,
                    page_count: book.pageCount ?? null,
                    price_cents: book.priceCents ?? null,
                    cover_file: book.cover ?? null,
                    created_at: now,
                    updated_at: now,
                })
                .execute();

            if (book.author) {
                await db
                    .insertInto('book_authors')
                    .values({
                        book_id: id,
                        author_id: authors.get(book.author) ?? (await author(book.author)),
                        position: 0,
                    })
                    .execute();
            }

            if (book.collectionId) {
                await db
                    .insertInto('collection_books')
                    .values({
                        book_id: id,
                        collection_id: book.collectionId,
                        volume_from: book.volume ?? 1,
                        volume_to: book.volume ?? 1,
                    })
                    .execute();
            }

            if (book.shelfId) {
                await db
                    .insertInto('book_shelves')
                    .values({ book_id: id, shelf_id: book.shelfId })
                    .execute();
            }

            for (const tagId of book.tagIds ?? []) {
                await db.insertInto('book_tags').values({ book_id: id, tag_id: tagId }).execute();
            }

            if (book.readBy) {
                await db
                    .insertInto('reading_statuses')
                    .values({ user_id: book.readBy, book_id: id, read: 1 })
                    .execute();
            }

            return id;
        },
    };
}
