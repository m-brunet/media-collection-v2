import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DatabaseSchema } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { Required } from '../../apps/server/src/shared/domain/required.helper.js';

const now = '2026-01-01T00:00:00.000Z';

export class DataDirectories {
    static readonly certificate = '6f1c2b0e-7d4a-4e8b-9c3f-2a5d8e1b4c70';
    private readonly paths: string[] = [];

    async empty(prefix: string): Promise<string> {
        const directory = await mkdtemp(join(tmpdir(), prefix));

        this.paths.push(directory);

        return directory;
    }

    async populated(prefix: string): Promise<string> {
        const directory = await mkdtemp(join(tmpdir(), prefix));

        this.paths.push(directory);
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
                    category: 'books',
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
            await db
                .insertInto('book_tags')
                .values({ book_id: ids.book, tag_id: ids.tag })
                .execute();
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
        await mkdir(join(directory, 'tls', DataDirectories.certificate), { recursive: true });
        await writeFile(join(directory, 'tls', DataDirectories.certificate, 'chain.pem'), 'chain');
        await writeFile(join(directory, 'tls', DataDirectories.certificate, 'key.pem'), 'key');
        await writeFile(join(directory, 'session.key'), 'machine secret');

        return directory;
    }

    async contents(directory: string) {
        const database = Database.openExisting(directory);
        const db = database.connection;
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

    static async categories(directory: string): Promise<string[]> {
        const database = Database.openExisting(directory);

        try {
            const rows = await database.connection
                .selectFrom('audit_logs')
                .select('category')
                .execute();

            return rows.map((row) => row.category);
        } finally {
            await database.close();
        }
    }

    async backupCategories(backup: string): Promise<string[]> {
        const directory = await this.empty('backup-content-');

        await writeFile(
            join(directory, 'application.sqlite'),
            Required.value(
                unzipSync(await readFile(backup))['application.sqlite'],
                'the backup holds application.sqlite',
            ),
        );

        return DataDirectories.categories(directory);
    }

    async cleanup(): Promise<void> {
        for (const path of this.paths.splice(0)) {
            await rm(path, { recursive: true, force: true });
        }
    }
}
