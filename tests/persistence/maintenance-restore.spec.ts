import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzipSync, zipSync } from 'fflate';
import BetterSqlite3 from 'better-sqlite3';
import { LocalMaintenance } from '../../apps/server/src/infrastructure/config/maintenance.js';
import { DataDirectoryFiles } from '../../apps/server/src/maintenance/infrastructure/adapters/driven/filesystem/data-directory-files.adapter.js';
import { FileMoves } from '../../apps/server/src/maintenance/infrastructure/adapters/driven/filesystem/file-moves.adapter.js';
import { RestoredDataCheck } from '../../apps/server/src/maintenance/infrastructure/adapters/driven/persistence/restored-data-check.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { DataDirectories } from './data-directories.test-support.js';

const directories = new DataDirectories();

afterEach(async () => {
    await directories.cleanup();
});

function sha256(bytes: Uint8Array) {
    return createHash('sha256').update(bytes).digest('hex');
}

// Writes a backup file holding the given entries, with a manifest matching them.
async function craftedBackup(entries: Record<string, Uint8Array>) {
    const destination = join(await directories.empty('files-'), 'crafted.mcbackup');
    const manifest = {
        format: 1,
        application: 'Media Collection',
        version: '0.1.0',
        createdAt: '2026-11-01T09:00:00.000Z',
        contents: { books: 1, accounts: 1 },
        checksums: Object.fromEntries(
            Object.entries(entries).map(([path, bytes]) => [path, sha256(bytes)]),
        ),
    };

    await writeFile(
        destination,
        zipSync({ ...entries, 'manifest.json': Buffer.from(JSON.stringify(manifest)) }),
    );

    return destination;
}

async function backupOf(directory: string) {
    const destination = join(await directories.empty('backups-'), 'backup.mcbackup');

    await new LocalMaintenance(directory, '0.1.0').createBackup(destination);

    return destination;
}

async function fileState(directory: string) {
    return {
        covers: (await readdir(join(directory, 'covers'))).sort(),
        sessionKey: sha256(await readFile(join(directory, 'session.key'))),
        working: (await readdir(directory)).filter((name) => name.startsWith('.')),
    };
}

class FailingMoves extends FileMoves {
    private count = 0;

    constructor(private readonly allowed: number) {
        super();
    }

    override async move(from: string, to: string): Promise<void> {
        this.count++;

        if (this.count > this.allowed && from.includes('.restore-')) {
            throw new Error('Move refused.');
        }

        return super.move(from, to);
    }
}

describe('local restore', () => {
    it('replaces the current library and accounts with the backup', async () => {
        const source = await directories.populated('source-');
        const backup = await backupOf(source);
        const target = await directories.populated('target-');
        const expected = await directories.contents(source);

        await new LocalMaintenance(target, '0.1.0').restoreBackup(backup);

        const restored = await directories.contents(target);

        expect({ ...restored.library, audit: 0 }).toEqual({ ...expected.library, audit: 0 });
        expect(restored.users).toEqual(expected.users);
        expect(restored.settings).toEqual(expected.settings);
    });
    it('restores the covers and the HTTPS certificate', async () => {
        const source = await directories.populated('source-');
        const backup = await backupOf(source);
        const target = await directories.empty('target-');
        const covers = (await readdir(join(source, 'covers'))).filter((file) =>
            file.endsWith('.jpg'),
        );

        await new LocalMaintenance(target, '0.1.0').restoreBackup(backup);

        const key = join(target, 'tls', DataDirectories.certificate, 'key.pem');

        expect(await readdir(join(target, 'covers'))).toEqual(covers);
        expect(await readFile(key, 'utf8')).toBe('key');
    });
    it('restores into a new installation, keeping the backed-up Admin', async () => {
        const backup = await backupOf(await directories.populated('source-'));
        const target = await directories.empty('target-');

        await new LocalMaintenance(target, '0.1.0').restoreBackup(backup);

        const status = await new LocalMaintenance(target, '0.1.0').status();

        expect(status).toEqual({ administrator: 'admin' });
    });
    it('ends every session with a new session key', async () => {
        const backup = await backupOf(await directories.populated('source-'));
        const target = await directories.populated('target-');
        const before = await fileState(target);

        await new LocalMaintenance(target, '0.1.0').restoreBackup(backup);

        expect((await fileState(target)).sessionKey).not.toBe(before.sessionKey);
    });
    it('describes the restored backup', async () => {
        const backup = await backupOf(await directories.populated('source-'));
        const target = await directories.empty('target-');

        const result = await new LocalMaintenance(target, '0.1.0').restoreBackup(backup);

        expect(result).toMatchObject({ version: '0.1.0', contents: { books: 1, accounts: 1 } });
    });
    it('records the restore in the restored data', async () => {
        const backup = await backupOf(await directories.populated('source-'));
        const target = await directories.empty('target-');

        await new LocalMaintenance(target, '0.1.0').restoreBackup(backup);

        expect(await DataDirectories.categories(target)).toEqual(
            expect.arrayContaining(['book.created', 'maintenance.backup-restored']),
        );
    });
    it('leaves no working folder behind', async () => {
        const backup = await backupOf(await directories.populated('source-'));
        const target = await directories.populated('target-');

        await new LocalMaintenance(target, '0.1.0').restoreBackup(backup);

        expect((await fileState(target)).working).toEqual([]);
    });
    it('rejects a backup of another version without changing the data', async () => {
        const target = await directories.populated('target-');
        const backup = await backupOf(await directories.populated('source-'));
        const before = await directories.contents(target);
        const files = await fileState(target);

        const result = await new LocalMaintenance(target, '0.2.0')
            .restoreBackup(backup)
            .catch((error: unknown) => error);

        expect(result).toMatchObject({ reason: 'backup-other-version' });
        expect(await fileState(target)).toEqual(files);
        expect(await directories.contents(target)).toEqual({
            ...before,
            library: { ...before.library, audit: before.library.audit + 1 },
        });
    });
    it('records a refused restore in the current data', async () => {
        const target = await directories.populated('target-');
        const backup = await backupOf(await directories.populated('source-'));

        await new LocalMaintenance(target, '0.2.0').restoreBackup(backup).catch(() => undefined);

        expect(await DataDirectories.categories(target)).toContain('maintenance.backup-restored');
    });
    it('rejects a file that is not a backup', async () => {
        const target = await directories.populated('target-');
        const file = join(await directories.empty('files-'), 'notes.mcbackup');

        await writeFile(file, 'not an archive');
        const files = await fileState(target);

        const result = await new LocalMaintenance(target, '0.1.0')
            .restoreBackup(file)
            .catch((error: unknown) => error);

        expect(result).toMatchObject({ reason: 'backup-invalid' });
        expect(await fileState(target)).toEqual(files);
    });
    it('rejects an archive without manifest', async () => {
        const target = await directories.empty('target-');
        const file = join(await directories.empty('files-'), 'other.mcbackup');

        await writeFile(file, zipSync({ 'notes.txt': Buffer.from('hello') }));

        const result = new LocalMaintenance(target, '0.1.0').restoreBackup(file);

        await expect(result).rejects.toMatchObject({ reason: 'backup-invalid' });
    });
    it('rejects a backup whose file changed after it was made', async () => {
        const backup = await backupOf(await directories.populated('source-'));
        const target = await directories.empty('target-');
        const entries = unzipSync(await readFile(backup));
        const cover = Object.keys(entries).find((path) => path.startsWith('covers/'))!;

        entries[cover] = Buffer.from('changed');
        await writeFile(backup, zipSync(entries));

        const result = new LocalMaintenance(target, '0.1.0').restoreBackup(backup);

        await expect(result).rejects.toMatchObject({ reason: 'backup-damaged' });
    });
    it('rejects a backup missing a cover its books use, keeping the data', async () => {
        const saved = unzipSync(await readFile(await backupOf(await directories.populated('s-'))));
        const file = await craftedBackup({ 'application.sqlite': saved['application.sqlite']! });
        const target = await directories.populated('target-');
        const files = await fileState(target);

        const result = await new LocalMaintenance(target, '0.1.0')
            .restoreBackup(file)
            .catch((error: unknown) => error);

        expect(result).toMatchObject({ reason: 'backup-damaged' });
        expect(await fileState(target)).toEqual(files);
    });
    it('rejects a damaged database', async () => {
        const file = await craftedBackup({ 'application.sqlite': Buffer.from('not a database') });
        const target = await directories.empty('target-');

        const result = new LocalMaintenance(target, '0.1.0').restoreBackup(file);

        await expect(result).rejects.toMatchObject({ reason: 'backup-damaged' });
    });
    it('rejects a database with another schema', async () => {
        const older = await directories.empty('older-');
        const sqlite = new BetterSqlite3(join(older, 'application.sqlite'));

        sqlite.exec(
            "CREATE TABLE users (id TEXT, role TEXT); INSERT INTO users VALUES ('1', 'admin')",
        );
        sqlite.close();
        const file = await craftedBackup({
            'application.sqlite': await readFile(join(older, 'application.sqlite')),
        });
        const target = await directories.empty('target-');

        const result = new LocalMaintenance(target, '0.1.0').restoreBackup(file);

        await expect(result).rejects.toMatchObject({ reason: 'backup-damaged' });
    });
});

describe('data directory replacement', () => {
    it('puts the current data back when a move fails', async () => {
        const source = await directories.populated('source-');
        const files = await new DataDirectoryFiles(
            source,
            new RestoredDataCheck(new UuidGenerator()),
        ).read();
        const target = await directories.populated('target-');
        const before = await directories.contents(target);
        const state = await fileState(target);
        const subject = new DataDirectoryFiles(
            target,
            new RestoredDataCheck(new UuidGenerator()),
            new FailingMoves(3),
        );

        const result = await subject.replace(files).catch((error: unknown) => error);

        expect(result).toMatchObject({ message: 'Move refused.' });
        expect(await directories.contents(target)).toEqual(before);
        expect(await fileState(target)).toEqual(state);
    });
});
