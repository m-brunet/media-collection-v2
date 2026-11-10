import { afterEach, beforeEach, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BackupFolder } from './backup-folder.adapter.js';

let documents: string;

beforeEach(() => {
    documents = mkdtempSync(join(tmpdir(), 'backup-folder-'));
});
afterEach(() => {
    rmSync(documents, { recursive: true, force: true });
});

it('places the folder in the Documents folder', () => {
    const folder = new BackupFolder(documents);

    const result = folder.path;

    expect(result).toBe(join(documents, 'Media Collection backups'));
});
it('creates the folder when it is missing', () => {
    const folder = new BackupFolder(join(documents, 'not yet created'));

    const result = folder.ensure();

    expect(existsSync(result)).toBe(true);
});
it('keeps the backups already in the folder', () => {
    const folder = new BackupFolder(documents);
    const backup = join(folder.ensure(), 'Media Collection backup.mcbackup');

    writeFileSync(backup, 'backup');

    folder.ensure();

    expect(existsSync(backup)).toBe(true);
});
