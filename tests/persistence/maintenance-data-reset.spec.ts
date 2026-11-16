import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { KyselyApplicationDataEraser } from '../../apps/server/src/maintenance/infrastructure/adapters/driven/persistence/kysely-application-data-eraser.adapter.js';
import { KyselyLibraryEraser } from '../../apps/server/src/maintenance/infrastructure/adapters/driven/persistence/kysely-library-eraser.adapter.js';
import { KyselyCoverFileCleanup } from '../../apps/server/src/maintenance/infrastructure/adapters/driven/persistence/kysely-cover-file-cleanup.adapter.js';
import { FileCoverStorage } from '../../apps/server/src/books/infrastructure/adapters/driven/filesystem/file-cover-storage.adapter.js';
import { DataDirectories } from './data-directories.test-support.js';

const directories = new DataDirectories();

afterEach(async () => {
    await directories.cleanup();
});

async function installation() {
    const directory = await directories.populated('reset-');
    const database = await Database.open(directory, new UuidGenerator());

    await database.connection
        .insertInto('users')
        .values({
            id: randomUUID(),
            username: 'camille',
            role: 'owner',
            password_hash: 'hash',
            must_change_password: 0,
            token_version: 0,
            created_at: '2026-01-01T00:00:00.000Z',
            language: null,
            active: 1,
        })
        .execute();
    await database.connection
        .insertInto('server_settings')
        .values([
            { id: randomUUID(), name: 'http', value: '{"port":36000}' },
            { id: randomUUID(), name: 'appearance', value: '{"colorScheme":"rose-noir"}' },
            { id: randomUUID(), name: 'icon-set', value: '{"iconSet":"hand-inked-editorial"}' },
            { id: randomUUID(), name: 'internet-access', value: '{"phase":"off"}' },
            { id: randomUUID(), name: 'keep-awake', value: '{"enabled":true}' },
        ])
        .execute();
    const admin = await database.connection
        .selectFrom('users')
        .select('id')
        .where('role', '=', 'admin')
        .executeTakeFirstOrThrow();

    return { directory, database, adminId: admin.id };
}

const resetAt = new Date('2026-11-16T09:00:00.000Z');

async function erase(database: Database, adminId: string, deleteKeptCovers = false) {
    await database.connections.run(() =>
        new KyselyApplicationDataEraser(
            database.connections,
            new KyselyLibraryEraser(database.connections, new UuidGenerator(), {
                now: () => resetAt,
            }),
        ).erase(adminId, deleteKeptCovers),
    );
}

function keptCovers(database: Database) {
    return database.connection
        .selectFrom('kept_covers')
        .select(['isbn13', 'file', 'kept_at'])
        .execute();
}

describe('application data eraser', () => {
    it('keeps the Admin and ends its sessions', async () => {
        const { database, adminId } = await installation();

        await erase(database, adminId);

        const users = await database.connection
            .selectFrom('users')
            .select(['username', 'token_version'])
            .execute();

        await database.close();
        expect(users).toEqual([{ username: 'admin', token_version: 2 }]);
    });
    it('keeps the host settings and removes the colour scheme and the icon set', async () => {
        const { database, adminId } = await installation();

        await erase(database, adminId);

        const settings = await database.connection
            .selectFrom('server_settings')
            .select('name')
            .orderBy('name')
            .execute();

        await database.close();
        expect(settings.map((setting) => setting.name)).toEqual([
            'http',
            'internet-access',
            'keep-awake',
            'test.setting',
        ]);
    });
    it('empties the library and the audit log', async () => {
        const { directory, database, adminId } = await installation();

        await erase(database, adminId);

        await database.close();
        const contents = await directories.contents(directory);

        expect(Object.values(contents.library).every((count) => count === 0)).toBe(true);
    });
    it('keeps the cover of each book under its ISBN', async () => {
        const { database, adminId } = await installation();
        const book = await database.connection
            .selectFrom('books')
            .select(['isbn13', 'cover_file'])
            .executeTakeFirstOrThrow();

        await erase(database, adminId);

        const kept = await keptCovers(database);

        await database.close();
        expect(kept).toEqual([
            { isbn13: book.isbn13, file: book.cover_file, kept_at: resetAt.toISOString() },
        ]);
    });
    it('replaces a cover kept earlier for the ISBN of a book', async () => {
        const { database, adminId } = await installation();
        const book = await database.connection
            .selectFrom('books')
            .select(['isbn13', 'cover_file'])
            .executeTakeFirstOrThrow();

        await database.connection
            .insertInto('kept_covers')
            .values({
                id: randomUUID(),
                isbn13: book.isbn13!,
                file: 'earlier.jpg',
                kept_at: '2026-01-01T00:00:00.000Z',
            })
            .execute();

        await erase(database, adminId);

        const kept = await keptCovers(database);

        await database.close();
        expect(kept.map((cover) => cover.file)).toEqual([book.cover_file]);
    });
    it('keeps a cover kept earlier for another ISBN', async () => {
        const { database, adminId } = await installation();

        await database.connection
            .insertInto('kept_covers')
            .values({
                id: randomUUID(),
                isbn13: '9782253164692',
                file: 'earlier.jpg',
                kept_at: '2026-01-01T00:00:00.000Z',
            })
            .execute();

        await erase(database, adminId);

        const kept = await keptCovers(database);

        await database.close();
        expect(kept.map((cover) => cover.isbn13).sort()).toEqual([
            '9781635575637',
            '9782253164692',
        ]);
    });
    it('deletes every kept cover when asked', async () => {
        const { database, adminId } = await installation();

        await erase(database, adminId, true);

        const kept = await keptCovers(database);

        await database.close();
        expect(kept).toEqual([]);
    });
    it('leaves the picture of a kept cover in place when the unused files are cleaned', async () => {
        const { directory, database, adminId } = await installation();
        const book = await database.connection
            .selectFrom('books')
            .select('cover_file')
            .executeTakeFirstOrThrow();

        await erase(database, adminId);

        await new KyselyCoverFileCleanup(
            database.connections,
            new FileCoverStorage(directory),
        ).removeUnreferenced();

        await database.close();
        expect(await readdir(join(directory, 'covers'))).toContain(book.cover_file);
    });
    it('removes the pictures once the kept covers are deleted', async () => {
        const { directory, database, adminId } = await installation();
        const book = await database.connection
            .selectFrom('books')
            .select('cover_file')
            .executeTakeFirstOrThrow();

        await erase(database, adminId, true);

        await new KyselyCoverFileCleanup(
            database.connections,
            new FileCoverStorage(directory),
        ).removeUnreferenced();

        await database.close();
        expect(await readdir(join(directory, 'covers'))).not.toContain(book.cover_file);
    });
    it('keeps the HTTPS certificate files', async () => {
        const { directory, database, adminId } = await installation();

        await erase(database, adminId);

        await database.close();
        expect(await readdir(join(directory, 'tls', DataDirectories.certificate))).toEqual([
            'chain.pem',
            'key.pem',
        ]);
    });
});

describe('cover file cleanup after a reset', () => {
    it('removes the stored covers that no book and no kept cover uses, leaving other files', async () => {
        const { directory, database, adminId } = await installation();
        const orphan = randomUUID() + '.jpg';

        await writeFile(join(directory, 'covers', orphan), 'image');
        await erase(database, adminId, true);
        const cleanup = new KyselyCoverFileCleanup(
            database.connections,
            new FileCoverStorage(directory),
        );

        const removed = await cleanup.removeUnreferenced();

        await database.close();
        expect(removed).toBe(2);
        expect(await readdir(join(directory, 'covers'))).toEqual(['notes.txt']);
    });
});
