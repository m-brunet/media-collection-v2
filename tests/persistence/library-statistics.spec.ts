import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { KyselyLibraryStatisticsReader } from '../../apps/server/src/statistics/infrastructure/adapters/driven/persistence/kysely-library-statistics-reader.adapter.js';
import { CollectionsModule } from '../../apps/server/src/collections/infrastructure/config/collections.module.js';
import { KyselyCollectionRepository } from '../../apps/server/src/collections/infrastructure/adapters/driven/persistence/kysely-collection.repository.js';
import { KyselyCollectionMemberStore } from '../../apps/server/src/collections/infrastructure/adapters/driven/persistence/kysely-collection-member-store.adapter.js';
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

interface Stored {
    title: string;
    category?: 'books' | 'manga' | 'comics';
    ownership?: 'owned' | 'not-owned';
    publisher?: string;
    pages?: number;
    priceCents?: number;
    authors?: string[];
    readBy?: string;
    collection?: { id: string; volume: number };
}

async function library() {
    const path = await mkdtemp(join(tmpdir(), 'library-statistics-'));

    paths.push(path);
    const database = await Database.open(path, new UuidGenerator());

    databases.push(database);
    const db = database.connection;
    const authors = new Map<string, string>();
    const author = async (name: string) => {
        const known = authors.get(name);

        if (known) {
            return known;
        }

        const id = randomUUID();

        await db
            .insertInto('authors')
            .values({ id, name, name_key: NameKey.of(name), created_at: now })
            .execute();
        authors.set(name, id);

        return id;
    };

    return {
        statistics: new KyselyLibraryStatisticsReader(database.connections),
        tallies: CollectionsModule.tallies(
            new KyselyCollectionRepository(database.connections),
            new KyselyCollectionMemberStore(database.connections),
        ),
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
        async collection(
            name: string,
            values: { category?: 'books' | 'manga' | 'comics'; finished?: boolean } = {},
        ) {
            const id = randomUUID();

            await db
                .insertInto('collections')
                .values({
                    id,
                    name,
                    name_key: NameKey.of(name),
                    category: values.category ?? 'manga',
                    includes_volume_zero: 0,
                    finished: values.finished ? 1 : 0,
                    created_at: now,
                    updated_at: now,
                })
                .execute();

            return id;
        },
        async book(book: Stored) {
            const id = randomUUID();

            await db
                .insertInto('books')
                .values({
                    id,
                    title: book.title,
                    title_key: NameKey.of(book.title),
                    title_generated: 0,
                    title_sort_key: NameKey.of(book.title),
                    isbn13: null,
                    isbn_converted: 0,
                    no_isbn: 1,
                    category: book.category ?? 'manga',
                    ownership: book.ownership ?? 'owned',
                    publisher: book.publisher ?? null,
                    publication_year: null,
                    publication_month: null,
                    summary: null,
                    page_count: book.pages ?? null,
                    price_cents: book.priceCents ?? null,
                    cover_file: null,
                    created_at: now,
                    updated_at: now,
                })
                .execute();

            for (const [position, name] of (book.authors ?? []).entries()) {
                await db
                    .insertInto('book_authors')
                    .values({ book_id: id, author_id: await author(name), position })
                    .execute();
            }

            if (book.readBy) {
                await db
                    .insertInto('reading_statuses')
                    .values({ user_id: book.readBy, book_id: id, read: 1 })
                    .execute();
            }

            if (book.collection) {
                await db
                    .insertInto('collection_books')
                    .values({
                        book_id: id,
                        collection_id: book.collection.id,
                        volume_from: book.collection.volume,
                        volume_to: book.collection.volume,
                    })
                    .execute();
            }

            return id;
        },
    };
}

describe('Library statistics', () => {
    it('totals the owned books, their pages and their price', async () => {
        const current = await library();

        await current.book({ title: 'Akira 1', pages: 360, priceCents: 1490 });
        await current.book({ title: 'Akira 2', pages: 380 });
        await current.book({ title: 'Akira 3' });
        await current.book({ title: 'Wanted', ownership: 'not-owned', pages: 900 });

        const totals = await current.statistics.totals(null);

        expect(totals).toEqual({
            ownedBooks: 3,
            singleBooks: 3,
            pages: { total: 740, known: 2 },
            price: { totalCents: 1490, known: 1 },
        });
    });
    it('counts the owned books in no collection as single books', async () => {
        const current = await library();
        const collection = await current.collection('Akira');

        await current.book({ title: 'Akira 1', collection: { id: collection, volume: 1 } });
        await current.book({ title: 'Dune' });

        const totals = await current.statistics.totals(null);

        expect(totals.singleBooks).toBe(1);
    });
    it('totals only the chosen category', async () => {
        const current = await library();

        await current.book({ title: 'Akira 1', pages: 360 });
        await current.book({ title: 'Dune', category: 'books', pages: 600 });

        const totals = await current.statistics.totals('books');

        expect([totals.ownedBooks, totals.pages.total]).toEqual([1, 600]);
    });
    it('splits the owned books by category', async () => {
        const current = await library();

        await current.book({ title: 'Akira 1' });
        await current.book({ title: 'Akira 2' });
        await current.book({ title: 'Asterix', category: 'comics' });
        await current.book({ title: 'Wanted', category: 'books', ownership: 'not-owned' });

        const categories = await current.statistics.categories();

        expect(categories).toEqual({ books: 0, manga: 2, comics: 1 });
    });
    it('counts what the viewer has read among the owned books', async () => {
        const current = await library();
        const camille = await current.reader();
        const sam = await current.reader();

        await current.book({ title: 'Akira 1', readBy: camille });
        await current.book({ title: 'Akira 2', readBy: sam });
        await current.book({ title: 'Wanted', ownership: 'not-owned', readBy: camille });

        const reading = await current.statistics.reading(camille, null);

        expect(reading).toEqual({ read: 1, notRead: 1 });
    });
    it('counts the books and the pages of each publisher', async () => {
        const current = await library();

        await current.book({ title: 'Akira 1', publisher: 'Glénat', pages: 360 });
        await current.book({ title: 'Akira 2', publisher: 'Glénat' });
        await current.book({ title: 'Monster 1', publisher: 'Kana', pages: 200 });
        await current.book({ title: 'Untitled' });

        const publishers = await current.statistics.publishers(null);

        expect(publishers).toEqual({
            counts: expect.arrayContaining([
                { name: 'Glénat', books: 2, pages: 360 },
                { name: 'Kana', books: 1, pages: 200 },
            ]),
            without: 1,
        });
    });
    it('counts a book once for each of its authors', async () => {
        const current = await library();

        await current.book({ title: 'Asterix 1', authors: ['René Goscinny', 'Albert Uderzo'] });
        await current.book({ title: 'Asterix 2', authors: ['René Goscinny', 'Albert Uderzo'] });
        await current.book({ title: 'Lucky Luke', authors: ['René Goscinny'] });

        const authors = await current.statistics.authors(null);

        expect(authors).toEqual(
            expect.arrayContaining([
                { name: 'René Goscinny', books: 3, pages: 0 },
                { name: 'Albert Uderzo', books: 2, pages: 0 },
            ]),
        );
    });
    it('sums the known pages of each author, a shared book counting for each of them', async () => {
        const current = await library();

        await current.book({ title: 'Asterix 1', pages: 48, authors: ['Goscinny', 'Uderzo'] });
        await current.book({ title: 'Asterix 2', authors: ['Goscinny', 'Uderzo'] });
        await current.book({ title: 'Lucky Luke', pages: 46, authors: ['Goscinny'] });
        await current.book({
            title: 'Wanted',
            pages: 500,
            ownership: 'not-owned',
            authors: ['Uderzo'],
        });

        const authors = await current.statistics.authors(null);

        expect(authors).toEqual(
            expect.arrayContaining([
                { name: 'Goscinny', books: 3, pages: 94 },
                { name: 'Uderzo', books: 2, pages: 48 },
            ]),
        );
    });
    it('sums the pages of the chosen category only', async () => {
        const current = await library();

        await current.book({ title: 'Akira 1', category: 'manga', pages: 360, authors: ['Otomo'] });
        await current.book({ title: 'Domu', category: 'comics', pages: 240, authors: ['Otomo'] });

        const authors = await current.statistics.authors('manga');

        expect(authors).toEqual([{ name: 'Otomo', books: 1, pages: 360 }]);
    });
    it('gives the longest owned book with its authors, equal lengths by title', async () => {
        const current = await library();

        await current.book({ title: 'Les Misérables', pages: 1664, authors: ['Victor Hugo'] });
        await current.book({ title: 'Gunnm', pages: 1664 });
        await current.book({ title: 'Wanted', ownership: 'not-owned', pages: 3000 });

        const longest = await current.statistics.longest(null);

        expect(longest).toMatchObject({ title: 'Gunnm', authors: [], value: 1664 });
    });
    it('gives the most expensive owned book', async () => {
        const current = await library();

        await current.book({ title: 'Akira box set', priceCents: 14900, authors: ['Otomo'] });
        await current.book({ title: 'Akira 1', priceCents: 1490 });

        const record = await current.statistics.mostExpensive(null);

        expect(record).toMatchObject({ title: 'Akira box set', authors: ['Otomo'], value: 14900 });
    });
    it('gives no record when no owned book has the value', async () => {
        const current = await library();

        await current.book({ title: 'Akira 1' });

        const record = await current.statistics.longest(null);

        expect(record).toBeNull();
    });
    it('tallies each collection with its owned books and missing volumes', async () => {
        const current = await library();
        const collection = await current.collection('Akira', { finished: true });

        await current.book({ title: 'Akira 1', collection: { id: collection, volume: 1 } });
        await current.book({ title: 'Akira 4', collection: { id: collection, volume: 4 } });

        const tallies = await current.tallies.all();

        expect(tallies).toEqual([
            {
                id: collection,
                name: 'Akira',
                category: 'manga',
                finished: true,
                ownedBooks: 2,
                missingVolumes: 2,
            },
        ]);
    });
});
