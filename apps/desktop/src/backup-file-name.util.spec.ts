import { expect, it } from 'vitest';
import { BackupFileName } from './backup-file-name.util.js';

it('names a backup after its local date and time', () => {
    const date = new Date(2026, 10, 8, 14, 30, 5);

    const result = BackupFileName.at(date);

    expect(result).toBe('Media Collection backup 2026-11-08 14-30-05.mcbackup');
});
it('pads single-digit months, days and times', () => {
    const date = new Date(2027, 0, 2, 3, 4, 5);

    const result = BackupFileName.at(date);

    expect(result).toBe('Media Collection backup 2027-01-02 03-04-05.mcbackup');
});
it('names a backup made before an update after the version it installs', () => {
    const date = new Date(2026, 10, 8, 14, 30, 5);

    const result = BackupFileName.at(date, '2.0.1');

    expect(result).toBe('Media Collection backup 2026-11-08 14-30-05 before 2.0.1.mcbackup');
});
