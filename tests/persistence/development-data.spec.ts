import { afterEach, describe, expect, it } from 'vitest';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DevelopmentDataCommands } from '../../apps/server/src/infrastructure/config/development-data.js';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { DataDirectories } from './data-directories.test-support.js';

const directories = new DataDirectories();

afterEach(async () => {
    await directories.cleanup();
});

describe('development data reset', () => {
    it('empties the library and the audit log, keeping accounts and settings', async () => {
        const directory = await directories.populated('dev-data-');

        const report = await DevelopmentDataCommands.reset(directory);
        const after = await directories.contents(directory);

        expect(report.join('\n')).toContain(
            'Deleted 1 books, 1 authors, 1 collections, 1 loans and 1 cover files.',
        );
        expect(Object.values(after.library).every((count) => count === 0)).toBe(true);
        expect(after.users).toEqual([{ username: 'admin', language: 'fr', token_version: 2 }]);
        expect(after.settings).toEqual([{ value: 'kept' }]);
        expect(after.covers).toEqual(['notes.txt']);
    });
    it('leaves another data directory untouched', async () => {
        const development = await directories.populated('dev-data-');
        const production = await directories.populated('production-data-');
        const before = await directories.contents(production);

        await DevelopmentDataCommands.reset(development);

        expect(await directories.contents(production)).toEqual(before);
    });
});

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]).toString('base64');

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
    const directory = await directories.empty('v1-source-');

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
        const directory = await directories.populated('dev-data-');
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
        const directory = await directories.populated('dev-data-');
        const before = await directories.contents(directory);
        const invalid = v1({ title: 'Wrong', isbn: '9781635575638', type: 'book' });
        const source = await dump([...library, invalid], { 'Ubel Blatt': 'manga' });

        const result = DevelopmentDataCommands.importV1(directory, source);

        await expect(result).rejects.toThrow();
        expect(await directories.contents(directory)).toEqual(before);
    });
});
