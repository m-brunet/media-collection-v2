import { describe, expect, it } from 'vitest';
import {
    FixedLibraryContents,
    HexChecksums,
    MaintenanceDoubles,
    MemoryArchive,
    MemoryDataFiles,
    MemoryJournal,
} from '../testing/maintenance-doubles.test-support.js';
import { CreateBackup } from './create-backup.usecase.js';

function backup(data: MemoryDataFiles, archive: MemoryArchive, journal = new MemoryJournal()) {
    return new CreateBackup(
        data,
        new FixedLibraryContents({ books: 3, accounts: 2 }),
        archive,
        new HexChecksums(),
        journal,
        MaintenanceDoubles.clock,
        '0.1.0',
    );
}

describe('CreateBackup', () => {
    it('saves every application data file', async () => {
        const archive = new MemoryArchive();
        const subject = backup(new MemoryDataFiles(MaintenanceDoubles.library()), archive);

        await subject.execute('backup.mcbackup');

        expect(archive.saved.get('backup.mcbackup')!.files).toEqual(MaintenanceDoubles.library());
    });
    it('describes the version, date, contents and checksums in the manifest', async () => {
        const archive = new MemoryArchive();
        const checksums = new HexChecksums();
        const subject = backup(new MemoryDataFiles(MaintenanceDoubles.library()), archive);

        await subject.execute('backup.mcbackup');

        expect(archive.saved.get('backup.mcbackup')!.manifest).toEqual({
            format: 1,
            application: 'Media Collection',
            version: '0.1.0',
            createdAt: '2026-11-08T13:30:05.000Z',
            contents: { books: 3, accounts: 2 },
            checksums: Object.fromEntries(
                MaintenanceDoubles.library().map((file) => [file.path, checksums.of(file.bytes)]),
            ),
        });
    });
    it('describes the saved backup', async () => {
        const subject = backup(
            new MemoryDataFiles(MaintenanceDoubles.library()),
            new MemoryArchive(),
        );

        const result = await subject.execute('backup.mcbackup');

        expect(result).toEqual({
            version: '0.1.0',
            createdAt: '2026-11-08T13:30:05.000Z',
            contents: { books: 3, accounts: 2 },
        });
    });
    it('records the backup', async () => {
        const journal = new MemoryJournal();
        const subject = backup(
            new MemoryDataFiles(MaintenanceDoubles.library()),
            new MemoryArchive(),
            journal,
        );

        await subject.execute('backup.mcbackup');

        expect(journal.records).toEqual([
            {
                category: 'maintenance.backup-created',
                outcome: 'successful',
                details: {
                    version: '0.1.0',
                    createdAt: '2026-11-08T13:30:05.000Z',
                    contents: { books: 3, accounts: 2 },
                },
                error: null,
            },
        ]);
    });
    it('refuses an installation without data', async () => {
        const archive = new MemoryArchive();
        const subject = backup(new MemoryDataFiles(null), archive);

        const result = subject.execute('backup.mcbackup');

        await expect(result).rejects.toMatchObject({ reason: 'backup-nothing' });
        expect(archive.saved.size).toBe(0);
    });
    it('records a backup that could not be written as failed', async () => {
        const archive = new MemoryArchive();
        const journal = new MemoryJournal();

        archive.failWrite = true;
        const subject = backup(new MemoryDataFiles(MaintenanceDoubles.library()), archive, journal);

        const result = await subject.execute('backup.mcbackup').catch((error: unknown) => error);

        expect(result).toMatchObject({ message: 'The disk is full.' });
        expect(journal.records).toEqual([
            expect.objectContaining({ category: 'maintenance.backup-created', outcome: 'failed' }),
        ]);
    });
});
