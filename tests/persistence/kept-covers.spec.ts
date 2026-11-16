import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KyselyKeptCoverStore } from '../../apps/server/src/books/infrastructure/adapters/driven/persistence/kysely-kept-cover-store.adapter.js';
import { KyselyKeptCoverCount } from '../../apps/server/src/maintenance/infrastructure/adapters/driven/persistence/kysely-kept-cover-count.adapter.js';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { DataDirectories } from './data-directories.test-support.js';

const directories = new DataDirectories();
const paths: string[] = [];
const databases: Database[] = [];
const isbn = '9782253164692';

afterEach(async () => {
    for (const database of databases.splice(0)) {
        await database.close();
    }

    for (const path of paths.splice(0)) {
        await rm(path, { recursive: true, force: true });
    }

    await directories.cleanup();
});

async function empty() {
    const path = await mkdtemp(join(tmpdir(), 'kept-covers-'));

    paths.push(path);
    const database = await Database.open(path, new UuidGenerator());

    databases.push(database);

    return { database, store: new KyselyKeptCoverStore(database.connections) };
}

async function populated() {
    const database = await Database.open(
        await directories.populated('kept-covers-'),
        new UuidGenerator(),
    );

    databases.push(database);

    return database;
}

function kept(file: string, isbn13 = isbn) {
    return { id: randomUUID(), isbn13, file, keptAt: '2026-11-16T09:00:00.000Z' };
}

describe('kept covers', () => {
    it('finds nothing for an ISBN without a kept cover', async () => {
        const { store } = await empty();

        const found = await store.find(isbn);

        expect(found).toBeNull();
    });

    it('finds the cover kept for an ISBN', async () => {
        const { store } = await empty();
        const cover = kept('a.jpg');

        await store.put(cover);

        const found = await store.find(isbn);

        expect(found).toEqual(cover);
    });

    it('keeps one cover per ISBN: the latest replaces the earlier one', async () => {
        const { database, store } = await empty();

        await store.put(kept('a.jpg'));

        await store.put(kept('b.jpg'));

        const rows = await database.connection.selectFrom('kept_covers').select('file').execute();

        expect(rows).toEqual([{ file: 'b.jpg' }]);
    });

    it('removes the cover kept for an ISBN', async () => {
        const { store } = await empty();

        await store.put(kept('a.jpg'));

        await store.remove(isbn);

        expect(await store.find(isbn)).toBeNull();
    });

    it('refuses an identifier that is not a UUID', async () => {
        const { store } = await empty();

        const result = store.put({ ...kept('a.jpg'), id: 'not-a-uuid' });

        await expect(result).rejects.toThrow();
    });

    it('refuses a second row for the same ISBN', async () => {
        const { database } = await empty();
        const insert = (file: string) =>
            database.connection
                .insertInto('kept_covers')
                .values({ id: randomUUID(), isbn13: isbn, file, kept_at: '2026-11-16' })
                .execute();

        await insert('a.jpg');

        const result = insert('b.jpg');

        await expect(result).rejects.toThrow();
    });
});

describe('kept cover count', () => {
    it('counts the book covers a reset would keep', async () => {
        const database = await populated();

        const count = await new KyselyKeptCoverCount(database.connections).afterReset();

        expect(count).toBe(1);
    });

    it('adds the covers already kept for other ISBNs', async () => {
        const database = await populated();

        await new KyselyKeptCoverStore(database.connections).put(kept('a.jpg'));

        const count = await new KyselyKeptCoverCount(database.connections).afterReset();

        expect(count).toBe(2);
    });

    it('counts an ISBN once when a book and a kept cover share it', async () => {
        const database = await populated();

        await new KyselyKeptCoverStore(database.connections).put(kept('a.jpg', '9781635575637'));

        const count = await new KyselyKeptCoverCount(database.connections).afterReset();

        expect(count).toBe(1);
    });

    it('counts nothing in an empty library', async () => {
        const { database } = await empty();

        const count = await new KyselyKeptCoverCount(database.connections).afterReset();

        expect(count).toBe(0);
    });
});
