import { describe, expect, it } from 'vitest';
import {
    HexChecksums,
    MaintenanceDoubles,
    MemoryArchive,
} from '../testing/maintenance-doubles.test-support.js';
import { BackupManifest } from '../../domain/value-objects/backup-manifest.value-object.js';
import { BackupReader } from '../services/backup-reader.service.js';
import { InspectBackup } from './inspect-backup.usecase.js';

describe('InspectBackup', () => {
    it('describes a restorable backup', async () => {
        const archive = new MemoryArchive();
        const checksums = new HexChecksums();
        const files = MaintenanceDoubles.library();
        const manifest = BackupManifest.create(
            '0.1.0',
            '2026-11-08T13:30:05.000Z',
            { books: 3, accounts: 2 },
            Object.fromEntries(files.map((file) => [file.path, checksums.of(file.bytes)])),
        );

        await archive.write('backup.mcbackup', manifest.snapshot, files);
        const subject = new InspectBackup(new BackupReader(archive, checksums, '0.1.0'));

        const result = await subject.execute('backup.mcbackup');

        expect(result).toEqual({
            version: '0.1.0',
            createdAt: '2026-11-08T13:30:05.000Z',
            contents: { books: 3, accounts: 2 },
        });
    });
    it('rejects a file that is not a backup', async () => {
        const subject = new InspectBackup(
            new BackupReader(new MemoryArchive(), new HexChecksums(), '0.1.0'),
        );

        const result = subject.execute('notes.txt');

        await expect(result).rejects.toMatchObject({ reason: 'backup-invalid' });
    });
});
