import { describe, expect, it } from 'vitest';
import {
    CountingSessionKeyRotation,
    HexChecksums,
    MaintenanceDoubles,
    MemoryArchive,
    MemoryDataFiles,
    MemoryJournal,
} from '../testing/maintenance-doubles.test-support.js';
import { BackupManifest } from '../../domain/value-objects/backup-manifest.value-object.js';
import { BackupReader } from '../services/backup-reader.service.js';
import { RestoreBackup } from './restore-backup.usecase.js';

const backupFiles = [
    MaintenanceDoubles.file('application.sqlite', 'backed-up database'),
    MaintenanceDoubles.file('covers/1b6f3c3e-8a51-4c8e-9a43-7f1a3f0e5b11.png', 'backed-up cover'),
];

async function archiveWith(version: string) {
    const archive = new MemoryArchive();
    const checksums = new HexChecksums();
    const manifest = BackupManifest.create(
        version,
        '2026-11-01T09:00:00.000Z',
        { books: 5, accounts: 3 },
        Object.fromEntries(backupFiles.map((file) => [file.path, checksums.of(file.bytes)])),
    );

    await archive.write('backup.mcbackup', manifest.snapshot, backupFiles);

    return archive;
}

class Restoration {
    readonly data = new MemoryDataFiles(MaintenanceDoubles.library());
    readonly sessions = new CountingSessionKeyRotation();
    readonly journal = new MemoryJournal();

    constructor(private readonly archive: MemoryArchive) {}

    get subject(): RestoreBackup {
        return new RestoreBackup(
            new BackupReader(this.archive, new HexChecksums(), '0.1.0'),
            this.data,
            this.sessions,
            this.journal,
        );
    }
}

describe('RestoreBackup', () => {
    it('replaces the application data with the backup', async () => {
        const restoration = new Restoration(await archiveWith('0.1.0'));

        await restoration.subject.execute('backup.mcbackup');

        expect(restoration.data.files).toEqual(backupFiles);
    });
    it('describes the restored backup', async () => {
        const restoration = new Restoration(await archiveWith('0.1.0'));

        const result = await restoration.subject.execute('backup.mcbackup');

        expect(result).toEqual({
            version: '0.1.0',
            createdAt: '2026-11-01T09:00:00.000Z',
            contents: { books: 5, accounts: 3 },
        });
    });
    it('ends every session', async () => {
        const restoration = new Restoration(await archiveWith('0.1.0'));

        await restoration.subject.execute('backup.mcbackup');

        expect(restoration.sessions.rotations).toBe(1);
    });
    it('records the restore in the restored data', async () => {
        const restoration = new Restoration(await archiveWith('0.1.0'));

        await restoration.subject.execute('backup.mcbackup');

        expect(restoration.journal.records).toEqual([
            {
                category: 'maintenance.backup-restored',
                outcome: 'successful',
                details: {
                    version: '0.1.0',
                    createdAt: '2026-11-01T09:00:00.000Z',
                    contents: { books: 5, accounts: 3 },
                },
                error: null,
            },
        ]);
    });
    it('keeps the current data when the backup is from another version', async () => {
        const restoration = new Restoration(await archiveWith('0.2.0'));

        const result = await restoration.subject
            .execute('backup.mcbackup')
            .catch((error: unknown) => error);

        expect(result).toMatchObject({ reason: 'backup-other-version' });
        expect(restoration.data.files).toEqual(MaintenanceDoubles.library());
        expect(restoration.sessions.rotations).toBe(0);
    });
    it('records a refused restore as failed in the current data', async () => {
        const restoration = new Restoration(await archiveWith('0.2.0'));

        await restoration.subject.execute('backup.mcbackup').catch(() => undefined);

        expect(restoration.journal.records).toEqual([
            expect.objectContaining({
                category: 'maintenance.backup-restored',
                outcome: 'failed',
                error: expect.objectContaining({ reason: 'backup-other-version' }),
            }),
        ]);
    });
    it('keeps the sessions when the data cannot be replaced', async () => {
        const restoration = new Restoration(await archiveWith('0.1.0'));

        restoration.data.failReplace = true;

        const result = await restoration.subject
            .execute('backup.mcbackup')
            .catch((error: unknown) => error);

        expect(result).toMatchObject({ reason: 'backup-damaged' });
        expect(restoration.sessions.rotations).toBe(0);
    });
    it('restores into an installation without data', async () => {
        const restoration = new Restoration(await archiveWith('0.1.0'));

        restoration.data.files = null;

        await restoration.subject.execute('backup.mcbackup');

        expect(restoration.data.files).toEqual(backupFiles);
    });
    it('records nothing for a refused restore into an installation without data', async () => {
        const restoration = new Restoration(await archiveWith('0.2.0'));

        restoration.data.files = null;

        await restoration.subject.execute('backup.mcbackup').catch(() => undefined);

        expect(restoration.journal.records).toEqual([]);
    });
});
