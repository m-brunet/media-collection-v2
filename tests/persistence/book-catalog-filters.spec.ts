import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { KyselyBookCatalog } from '../../apps/server/src/books/infrastructure/adapters/driven/persistence/kysely-book-catalog.adapter.js';
import type { BookFilterCriteria } from '../../apps/server/src/shared/application/book-filter.js';
import { BookFilter } from '../../apps/server/src/shared/application/book-filter.js';
import { NameKey } from '../../apps/server/src/shared/domain/name-key.helper.js';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';

const now = '2026-01-01T00:00:00.000Z';
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

interface Shelved {
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
}

async function library() {
    const path = await mkdtemp(join(tmpdir(), 'catalog-filters-'));

    paths.push(path);
    const database = await Database.open(path, new UuidGenerator());

    databases.push(database);
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
        async book(book: Shelved) {
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
                    page_count: null,
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

async function titles(
    current: Awaited<ReturnType<typeof library>>,
    criteria: Partial<BookFilterCriteria>,
    search = '',
    readerId: string | null = null,
) {
    const page = await current.catalog.search({
        search,
        sort: 'title',
        direction: 'asc',
        offset: 0,
        limit: 48,
        readerId,
        filter: BookFilter.of(criteria),
    });

    return page.items.map((item) => item.title);
}

describe('KyselyBookCatalog filters', () => {
    it('accepts either chosen category but requires ownership and location (example 8)', async () => {
        const current = await library();
        const oak = await current.bookcase('Oak');
        const top = await current.shelf(oak);
        const hall = await current.shelf(await current.bookcase('Hall'));

        await current.book({ title: 'Manga A', category: 'manga', shelfId: top });
        await current.book({ title: 'Comics A', category: 'comics', shelfId: top });
        await current.book({ title: 'Novel A', category: 'books', shelfId: top });
        await current.book({
            title: 'Manga planned',
            category: 'manga',
            ownership: 'not-owned',
            shelfId: top,
        });
        await current.book({ title: 'Manga elsewhere', category: 'manga', shelfId: hall });

        const result = await titles(current, {
            categories: ['manga', 'comics'],
            ownerships: ['owned'],
            locations: { bookcaseIds: [oak], shelfIds: [], none: false },
        });

        expect(result).toEqual(['Comics A', 'Manga A']);
    });
    it('requires every included tag and rejects any excluded tag (example 9)', async () => {
        const current = await library();
        const fantasy = await current.tag('Fantasy');
        const adventure = await current.tag('Adventure');
        const medieval = await current.tag('Medieval');

        await current.book({ title: 'Both', tagIds: [fantasy, adventure] });
        await current.book({ title: 'Both and medieval', tagIds: [fantasy, adventure, medieval] });
        await current.book({ title: 'Only fantasy', tagIds: [fantasy] });

        const result = await titles(current, {
            tags: { include: [fantasy, adventure], exclude: [medieval] },
        });

        expect(result).toEqual(['Both']);
    });
    it('narrows the filtered books with the search text (example 9)', async () => {
        const current = await library();
        const fantasy = await current.tag('Fantasy');

        await current.book({ title: 'Earthsea', tagIds: [fantasy] });
        await current.book({ title: 'Gormenghast', tagIds: [fantasy] });
        await current.book({ title: 'Gormenghast untagged' });

        const result = await titles(
            current,
            { tags: { include: [fantasy], exclude: [] } },
            'gormen',
        );

        expect(result).toEqual(['Gormenghast']);
    });
    it('selects books without a location or a collection (example 10)', async () => {
        const current = await library();
        const top = await current.shelf(await current.bookcase('Oak'));
        const batman = await current.collection('Batman');

        await current.book({ title: 'Shelved', shelfId: top });
        await current.book({ title: 'Member', collectionId: batman });
        await current.book({ title: 'Loose' });

        const result = await titles(current, {
            locations: { bookcaseIds: [], shelfIds: [], none: true },
            collections: { ids: [], none: true },
        });

        expect(result).toEqual(['Loose']);
    });
    it('accepts a chosen collection or no collection together', async () => {
        const current = await library();
        const batman = await current.collection('Batman');
        const dune = await current.collection('Dune');

        await current.book({ title: 'Batman 1', collectionId: batman });
        await current.book({ title: 'Dune 1', collectionId: dune });
        await current.book({ title: 'Standalone' });

        const result = await titles(current, { collections: { ids: [batman], none: true } });

        expect(result).toEqual(['Batman 1', 'Standalone']);
    });
    it('filters on the reading status of the reader only', async () => {
        const current = await library();
        const camille = await current.reader();
        const sam = await current.reader();

        await current.book({ title: 'Read by Camille', readBy: camille });
        await current.book({ title: 'Read by Sam', readBy: sam });

        const result = await titles(current, { reading: ['unread'] }, '', camille);

        expect(result).toEqual(['Read by Sam']);
    });
    it('selects the books without a cover', async () => {
        const current = await library();

        await current.book({ title: 'Covered', cover: 'covered.jpg' });
        await current.book({ title: 'Bare' });

        const result = await titles(current, { covers: ['without'] });

        expect(result).toEqual(['Bare']);
    });
    it('selects the books with a cover', async () => {
        const current = await library();

        await current.book({ title: 'Covered', cover: 'covered.jpg' });
        await current.book({ title: 'Bare' });

        const result = await titles(current, { covers: ['with'] });

        expect(result).toEqual(['Covered']);
    });
    it('selects the books without a price', async () => {
        const current = await library();

        await current.book({ title: 'Priced', priceCents: 1290 });
        await current.book({ title: 'Unpriced' });
        await current.book({ title: 'Unpriced wish', ownership: 'not-owned' });

        const result = await titles(current, { prices: ['without'] });

        expect(result).toEqual(['Unpriced', 'Unpriced wish']);
    });
    it('selects the books with a price', async () => {
        const current = await library();

        await current.book({ title: 'Priced', priceCents: 1290 });
        await current.book({ title: 'Unpriced' });

        const result = await titles(current, { prices: ['with'] });

        expect(result).toEqual(['Priced']);
    });
    it('keeps every book when both cover and price choices are chosen', async () => {
        const current = await library();

        await current.book({ title: 'Complete', cover: 'complete.jpg', priceCents: 990 });
        await current.book({ title: 'Empty' });

        const result = await titles(current, {
            covers: ['with', 'without'],
            prices: ['with', 'without'],
        });

        expect(result).toEqual(['Complete', 'Empty']);
    });
    it('selects the books missing both a cover and a price', async () => {
        const current = await library();

        await current.book({ title: 'Complete', cover: 'complete.jpg', priceCents: 990 });
        await current.book({ title: 'Cover only', cover: 'cover-only.jpg' });
        await current.book({ title: 'Price only', priceCents: 990 });
        await current.book({ title: 'Empty' });

        const result = await titles(current, { covers: ['without'], prices: ['without'] });

        expect(result).toEqual(['Empty']);
    });
    it('finds partial names ignoring case and accents (example 14)', async () => {
        const current = await library();

        await current.book({ title: 'The Hobbit', author: 'J. R. R. Tolkien' });
        await current.book({ title: 'Élan vital' });
        await current.book({ title: 'Dune', author: 'Frank Herbert' });

        const result = [await titles(current, {}, 'TOLK'), await titles(current, {}, 'elan')];

        expect(result).toEqual([['The Hobbit'], ['Élan vital']]);
    });
    it('finds a book from the equivalent ISBN-10 (example 14)', async () => {
        const current = await library();

        await current.book({ title: 'Rasselas', isbn13: '9780306406157' });

        const result = await titles(current, {}, '0-306-40615-2');

        expect(result).toEqual(['Rasselas']);
    });
});

describe('KyselyBookCatalog collection matches', () => {
    it('excludes a collection whose books each satisfy only part of the filter (example 11)', async () => {
        const current = await library();
        const fantasy = await current.tag('Fantasy');
        const split = await current.collection('Split');
        const whole = await current.collection('Whole');

        await current.book({
            title: 'Split 1',
            collectionId: split,
            volume: 1,
            author: 'Ursula Le Guin',
        });
        await current.book({ title: 'Split 2', collectionId: split, volume: 2, tagIds: [fantasy] });
        await current.book({
            title: 'Whole 1',
            collectionId: whole,
            author: 'Ursula Le Guin',
            tagIds: [fantasy],
        });

        const result = await current.catalog.collectionsMatching(
            'le guin',
            BookFilter.of({ tags: { include: [fantasy], exclude: [] } }),
            null,
        );

        expect(result).toEqual([whole]);
    });
    it('matches a collection through any one of its books', async () => {
        const current = await library();
        const batman = await current.collection('Batman');

        await current.book({
            title: 'Year One',
            collectionId: batman,
            volume: 1,
            category: 'comics',
        });
        await current.book({ title: 'Hush', collectionId: batman, volume: 2, category: 'books' });

        const result = await current.catalog.collectionsMatching(
            '',
            BookFilter.of({ categories: ['comics'] }),
            null,
        );

        expect(result).toEqual([batman]);
    });
    it('matches a collection with one volume without a cover', async () => {
        const current = await library();
        const dune = await current.collection('Dune');
        const batman = await current.collection('Batman');

        await current.book({ title: 'Dune 1', collectionId: dune, volume: 1, cover: 'dune-1.jpg' });
        await current.book({ title: 'Dune 2', collectionId: dune, volume: 2 });
        await current.book({ title: 'Batman 1', collectionId: batman, cover: 'batman-1.jpg' });

        const result = await current.catalog.collectionsMatching(
            '',
            BookFilter.of({ covers: ['without'] }),
            null,
        );

        expect(result).toEqual([dune]);
    });
});
