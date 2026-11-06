import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DevelopmentDataCommands } from '../../apps/server/src/infrastructure/config/development-data.js';
import type { DatabaseSchema } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';

const now = '2026-01-01T00:00:00.000Z';
const paths: string[] = [];

afterEach(async () => {
    for (const path of paths.splice(0)) {
        await rm(path, { recursive: true, force: true });
    }
});

// A data directory holding one record in every library table, an account and a server setting.
async function populated(prefix: string) {
    const directory = await mkdtemp(join(tmpdir(), prefix));

    paths.push(directory);
    const database = await Database.open(directory, new UuidGenerator());
    const db = database.connection;
    const ids = {
        user: randomUUID(),
        book: randomUUID(),
        author: randomUUID(),
        collection: randomUUID(),
        bookcase: randomUUID(),
        shelf: randomUUID(),
        tag: randomUUID(),
        receiver: randomUUID(),
    };
    const cover = randomUUID() + '.jpg';

    try {
        await db
            .insertInto('users')
            .values({
                id: ids.user,
                username: 'admin',
                role: 'admin',
                password_hash: 'hash',
                must_change_password: 0,
                token_version: 1,
                created_at: now,
                language: 'fr',
                active: 1,
            })
            .execute();
        await db
            .insertInto('server_settings')
            .values({ id: randomUUID(), name: 'test.setting', value: 'kept' })
            .execute();
        await db
            .insertInto('books')
            .values({
                id: ids.book,
                title: 'Piranesi',
                title_key: 'piranesi',
                title_generated: 0,
                title_sort_key: 'piranesi',
                isbn13: '9781635575637',
                isbn_converted: 0,
                no_isbn: 0,
                category: 'books',
                ownership: 'owned',
                publisher: null,
                publication_year: null,
                publication_month: null,
                summary: null,
                page_count: null,
                price_cents: null,
                cover_file: cover,
                created_at: now,
                updated_at: now,
            })
            .execute();
        await db
            .insertInto('authors')
            .values({
                id: ids.author,
                name: 'Susanna Clarke',
                name_key: 'susanna clarke',
                created_at: now,
            })
            .execute();
        await db
            .insertInto('book_authors')
            .values({ book_id: ids.book, author_id: ids.author, position: 0 })
            .execute();
        await db
            .insertInto('reading_statuses')
            .values({ user_id: ids.user, book_id: ids.book, read: 1 })
            .execute();
        await db
            .insertInto('personal_notes')
            .values({ user_id: ids.user, book_id: ids.book, text: 'Mine', updated_at: now })
            .execute();
        await db
            .insertInto('collections')
            .values({
                id: ids.collection,
                name: 'Solo',
                name_key: 'solo',
                includes_volume_zero: 0,
                finished: 0,
                created_at: now,
                updated_at: now,
            })
            .execute();
        await db
            .insertInto('collection_books')
            .values({
                book_id: ids.book,
                collection_id: ids.collection,
                volume_from: 1,
                volume_to: 1,
            })
            .execute();
        await db
            .insertInto('bookcases')
            .values({
                id: ids.bookcase,
                name: 'Hall',
                name_key: 'hall',
                created_at: now,
                updated_at: now,
            })
            .execute();
        await db
            .insertInto('shelves')
            .values({
                id: ids.shelf,
                bookcase_id: ids.bookcase,
                name: 'Top',
                name_key: 'top',
                created_at: now,
                updated_at: now,
            })
            .execute();
        await db
            .insertInto('book_shelves')
            .values({ book_id: ids.book, shelf_id: ids.shelf })
            .execute();
        await db
            .insertInto('tags')
            .values({
                id: ids.tag,
                name: 'Gift',
                name_key: 'gift',
                created_at: now,
                updated_at: now,
            })
            .execute();
        await db.insertInto('book_tags').values({ book_id: ids.book, tag_id: ids.tag }).execute();
        await db
            .insertInto('receivers')
            .values({ id: ids.receiver, name: 'Sam', name_key: 'sam', created_at: now })
            .execute();
        await db
            .insertInto('loans')
            .values({
                id: randomUUID(),
                book_id: ids.book,
                receiver_id: ids.receiver,
                status: 'lent',
                lent_at: now,
                returned_at: null,
                book_title: 'Piranesi',
                book_isbn: '9781635575637',
            })
            .execute();
        await db
            .insertInto('audit_logs')
            .values({
                id: randomUUID(),
                operation_id: randomUUID(),
                category: 'book.created',
                outcome: 'successful',
                actor_id: ids.user,
                occurred_at: now,
                subject_type: 'book',
                subject_id: ids.book,
                before_values: null,
                after_values: null,
                failure: null,
            })
            .execute();
    } finally {
        await database.close();
    }

    await mkdir(join(directory, 'covers'));
    await writeFile(join(directory, 'covers', cover), 'image');
    await writeFile(join(directory, 'covers', 'notes.txt'), 'not a cover');

    return directory;
}

async function contents(directory: string) {
    const database = Database.openExisting(directory);
    const db = database.connection;
    // Every table has the same count query; the single table name only satisfies the builder's types.
    const count = async (table: keyof DatabaseSchema) =>
        Number(
            (
                await db
                    .selectFrom(table as 'books')
                    .select((eb) => eb.fn.countAll().as('count'))
                    .executeTakeFirstOrThrow()
            ).count,
        );

    try {
        return {
            library: {
                books: await count('books'),
                authors: await count('authors'),
                bookAuthors: await count('book_authors'),
                readings: await count('reading_statuses'),
                notes: await count('personal_notes'),
                collections: await count('collections'),
                memberships: await count('collection_books'),
                bookcases: await count('bookcases'),
                shelves: await count('shelves'),
                bookShelves: await count('book_shelves'),
                tags: await count('tags'),
                bookTags: await count('book_tags'),
                receivers: await count('receivers'),
                loans: await count('loans'),
                audit: await count('audit_logs'),
            },
            users: await db
                .selectFrom('users')
                .select(['username', 'language', 'token_version'])
                .execute(),
            settings: await db
                .selectFrom('server_settings')
                .select('value')
                .where('name', '=', 'test.setting')
                .execute(),
            covers: (await readdir(join(directory, 'covers'))).sort(),
        };
    } finally {
        await database.close();
    }
}

describe('development data reset', () => {
    it('empties the library and the audit log, keeping accounts and settings', async () => {
        const directory = await populated('dev-data-');

        const report = await DevelopmentDataCommands.reset(directory);

        const after = await contents(directory);

        expect(report.join('\n')).toContain(
            'Deleted 1 books, 1 authors, 1 collections, 1 loans and 1 cover files.',
        );
        expect(Object.values(after.library).every((count) => count === 0)).toBe(true);
        expect(after.users).toEqual([{ username: 'admin', language: 'fr', token_version: 2 }]);
        expect(after.settings).toEqual([{ value: 'kept' }]);
        expect(after.covers).toEqual(['notes.txt']);
    });
    it('leaves another data directory untouched', async () => {
        const development = await populated('dev-data-');
        const production = await populated('production-data-');
        const before = await contents(production);

        await DevelopmentDataCommands.reset(development);

        expect(await contents(production)).toEqual(before);
    });
});

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]).toString('base64');

// A V1 book as exported by MongoDB, with the given fields.
function v1(fields: Record<string, unknown>) {
    return {
        _id: { $oid: '587ba8f8152f33d037131950' },
        cover: 'data:image/png;base64,' + png,
        price: { $numberDouble: '6.5' },
        publisher: 'Glénat',
        type: 'manga',
        created: { $date: { $numberLong: '1484499192369' } },
        lastElement: false,
        customFields: [],
        bookRate: { $numberInt: '0' },
        pageCount: { $numberInt: '200' },
        bought: true,
        read: 'NOTREAD',
        publishingDate: null,
        authors: ['Yukito Kishiro'],
        __v: { $numberInt: '0' },
        ...fields,
    };
}

async function dump(books: unknown[], categories: Record<string, string> = {}) {
    const directory = await mkdtemp(join(tmpdir(), 'v1-source-'));

    paths.push(directory);
    await writeFile(join(directory, 'books.json'), JSON.stringify(books));
    await writeFile(join(directory, 'category-corrections.json'), JSON.stringify(categories));

    return join(directory, 'books.json');
}

const library = [
    v1({
        title: 'Piranesi',
        isbn: '9781635575637',
        type: 'book',
        authors: ['Susanna Clarke'],
        read: 'READ',
        pageCount: { $numberInt: '0' },
        price: { $numberDouble: '9.9' },
    }),
    v1({ isbn: '9780306406157', collectionName: 'Ubel Blatt', volume: { $numberInt: '0' } }),
    v1({
        title: '',
        isbn: '9782811211554',
        type: 'book',
        collectionName: 'Ubel Blatt',
        volume: { $numberInt: '1' },
        lastElement: true,
    }),
    v1({
        title: 'Angel',
        isbn: '9781416589471',
        collectionName: 'Gunnm',
        volume: { $numberInt: '1' },
    }),
    v1({
        title: 'Last Order',
        isbn: '9781416589600',
        collectionName: 'Gunnm - Last Order',
        volume: { $numberInt: '1' },
        cover: 'http://127.0.0.1:9/unreachable.jpg',
    }),
];

describe('development V1 import', () => {
    it('replaces the library with the V1 books', async () => {
        const directory = await populated('dev-data-');
        const source = await dump(library, { 'Ubel Blatt': 'manga' });

        const report = await DevelopmentDataCommands.importV1(directory, source);

        const database = Database.openExisting(directory);
        const db = database.connection;
        const books = await db
            .selectFrom('books')
            .select([
                'title',
                'title_generated',
                'category',
                'page_count',
                'price_cents',
                'cover_file',
                'created_at',
                'updated_at',
            ])
            .orderBy('title')
            .execute();
        const collections = await db
            .selectFrom('collections')
            .select(['name', 'includes_volume_zero', 'finished'])
            .orderBy('name')
            .execute();
        const readings = await db.selectFrom('reading_statuses').select('read').execute();
        const audit = await db
            .selectFrom('audit_logs')
            .select(['actor_id', 'occurred_at'])
            .execute();
        const admin = await db.selectFrom('users').select('id').executeTakeFirstOrThrow();

        await database.close();
        const covers = await readdir(join(directory, 'covers'));

        expect(books.map((book) => [book.title, book.title_generated, book.category])).toEqual([
            ['Angel', 0, 'manga'],
            ['Last Order', 0, 'manga'],
            ['Piranesi', 0, 'books'],
            ['Ubel Blatt Vol. 0', 1, 'manga'],
            ['Ubel Blatt Vol. 1', 1, 'manga'],
        ]);
        expect(books[2]).toMatchObject({
            page_count: null,
            price_cents: 990,
            created_at: '2017-01-15T16:53:12.369Z',
        });
        expect(books[2]!.updated_at > '2026-01-01').toBe(true);
        expect(collections).toEqual([
            { name: 'Gunnm', includes_volume_zero: 0, finished: 0 },
            { name: 'Gunnm - Last Order', includes_volume_zero: 0, finished: 0 },
            { name: 'Ubel Blatt', includes_volume_zero: 1, finished: 1 },
        ]);
        expect(readings).toEqual([{ read: 1 }]);
        expect(
            audit.every((entry) => entry.actor_id === admin.id && entry.occurred_at > '2026-01-01'),
        ).toBe(true);
        expect(covers.filter((file) => file.endsWith('.png'))).toHaveLength(4);
        expect(covers).toContain('notes.txt');
        expect(covers.filter((file) => file.endsWith('.jpg'))).toEqual([]);
        expect(report).toContain('Marked Finished: Ubel Blatt.');
        expect(report).toContain('No cover for record 5 (Last Order): could not be downloaded.');
    });
    it('keeps the previous library when a book cannot be imported', async () => {
        const directory = await populated('dev-data-');
        const before = await contents(directory);
        const invalid = v1({ title: 'Wrong', isbn: '9781635575638', type: 'book' });
        const source = await dump([...library, invalid], { 'Ubel Blatt': 'manga' });

        const result = DevelopmentDataCommands.importV1(directory, source);

        await expect(result).rejects.toThrow();
        expect(await contents(directory)).toEqual(before);
    });
});
