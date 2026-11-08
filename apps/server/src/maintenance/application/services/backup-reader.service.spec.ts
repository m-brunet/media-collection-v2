import { describe, expect, it } from 'vitest';
import {
    HexChecksums,
    MaintenanceDoubles,
    MemoryArchive,
} from '../testing/maintenance-doubles.test-support.js';
import { BackupManifest } from '../../domain/value-objects/backup-manifest.value-object.js';
import type { DataFile } from '../data-file.js';
import { BackupReader } from './backup-reader.service.js';

async function saved(files: DataFile[], version = '0.1.0') {
    const archive = new MemoryArchive();
    const checksums = new HexChecksums();
    const manifest = BackupManifest.create(
        version,
        '2026-11-08T13:30:05.000Z',
        { books: 3, accounts: 2 },
        Object.fromEntries(files.map((file) => [file.path, checksums.of(file.bytes)])),
    );

    await archive.write('backup.mcbackup', manifest.snapshot, files);

    return archive;
}

describe('BackupReader', () => {
    it('reads a backup of the same version', async () => {
        const archive = await saved(MaintenanceDoubles.library());
        const subject = new BackupReader(archive, new HexChecksums(), '0.1.0');

        const result = await subject.read('backup.mcbackup');

        expect(result).toEqual({
            description: {
                version: '0.1.0',
                createdAt: '2026-11-08T13:30:05.000Z',
                contents: { books: 3, accounts: 2 },
            },
            files: MaintenanceDoubles.library(),
        });
    });
    it('rejects a backup of another version', async () => {
        const archive = await saved(MaintenanceDoubles.library(), '0.0.9');
        const subject = new BackupReader(archive, new HexChecksums(), '0.1.0');

        const result = subject.read('backup.mcbackup');

        await expect(result).rejects.toMatchObject({ reason: 'backup-other-version' });
    });
    it('rejects a file changed after the backup', async () => {
        const archive = await saved(MaintenanceDoubles.library());
        const backup = archive.saved.get('backup.mcbackup')!;

        backup.files[1] = MaintenanceDoubles.file(backup.files[1]!.path, 'another cover');
        const subject = new BackupReader(archive, new HexChecksums(), '0.1.0');

        const result = subject.read('backup.mcbackup');

        await expect(result).rejects.toMatchObject({ reason: 'backup-damaged' });
    });
    it('rejects a file that is not a backup', async () => {
        const subject = new BackupReader(new MemoryArchive(), new HexChecksums(), '0.1.0');

        const result = subject.read('notes.txt');

        await expect(result).rejects.toMatchObject({ reason: 'backup-invalid' });
    });
});
