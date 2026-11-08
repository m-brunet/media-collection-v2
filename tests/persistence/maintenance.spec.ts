import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { LocalMaintenance } from '../../apps/server/src/infrastructure/config/maintenance.js';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { DataDirectories } from './data-directories.test-support.js';

const directories = new DataDirectories();

afterEach(async () => {
    await directories.cleanup();
});

describe('local maintenance status', () => {
    it('names the protected administrator', async () => {
        const directory = await directories.populated('maintenance-');

        const status = await new LocalMaintenance(directory, '0.1.0').status();

        expect(status).toEqual({ administrator: 'admin', hasData: true });
    });
    it('reports a new installation without creating its database', async () => {
        const directory = await directories.empty('maintenance-');

        const status = await new LocalMaintenance(directory, '0.1.0').status();

        expect(status).toEqual({ administrator: null, hasData: false });
        expect(existsSync(join(directory, 'application.sqlite'))).toBe(false);
    });
});

describe('local administrator recovery', () => {
    it('records the recovery in the audit log', async () => {
        const directory = await directories.populated('maintenance-');

        await new LocalMaintenance(directory, '0.1.0').recover('recovered-password');

        const database = Database.openExisting(directory);
        const records = await database.connection
            .selectFrom('audit_logs')
            .select(['category', 'outcome', 'actor_id', 'subject_type'])
            .where('category', '=', 'account.recovered')
            .execute();

        await database.close();
        expect(records).toEqual([
            {
                category: 'account.recovered',
                outcome: 'successful',
                actor_id: null,
                subject_type: 'account',
            },
        ]);
    });
    it('refuses a new installation without creating its database', async () => {
        const directory = await directories.empty('maintenance-');

        const result = new LocalMaintenance(directory, '0.1.0').recover('recovered-password');

        await expect(result).rejects.toMatchObject({ reason: 'administrator-missing' });
        expect(existsSync(join(directory, 'application.sqlite'))).toBe(false);
    });
});

describe('local backup', () => {
    it('saves the database, the covers and the HTTPS certificate', async () => {
        const directory = await directories.populated('maintenance-');
        const destination = join(await directories.empty('backups-'), 'backup.mcbackup');
        const [cover] = (await readdir(join(directory, 'covers'))).filter((file) =>
            file.endsWith('.jpg'),
        );

        await new LocalMaintenance(directory, '0.1.0').createBackup(destination);

        const entries = unzipSync(await readFile(destination));

        expect(Object.keys(entries).sort()).toEqual([
            'application.sqlite',
            'covers/' + cover,
            'manifest.json',
            'tls/' + DataDirectories.certificate + '/chain.pem',
            'tls/' + DataDirectories.certificate + '/key.pem',
        ]);
        expect(Buffer.from(entries['covers/' + cover]!).toString()).toBe('image');
    });
    it('describes the version, date and contents in the manifest', async () => {
        const directory = await directories.populated('maintenance-');
        const destination = join(await directories.empty('backups-'), 'backup.mcbackup');

        await new LocalMaintenance(directory, '0.1.0').createBackup(destination);

        const manifest = JSON.parse(
            Buffer.from(unzipSync(await readFile(destination))['manifest.json']!).toString(),
        );

        expect(manifest).toMatchObject({
            format: 1,
            application: 'Media Collection',
            version: '0.1.0',
            contents: { books: 1, accounts: 1 },
        });
        expect(Object.keys(manifest.checksums)).toHaveLength(4);
    });
    it('records the backup in the current data only', async () => {
        const directory = await directories.populated('maintenance-');
        const destination = join(await directories.empty('backups-'), 'backup.mcbackup');

        await new LocalMaintenance(directory, '0.1.0').createBackup(destination);

        const current = await DataDirectories.categories(directory);
        const saved = await directories.backupCategories(destination);

        expect(current).toContain('maintenance.backup-created');
        expect(saved).not.toContain('maintenance.backup-created');
        expect(saved).toContain('book.created');
    });
    it('leaves no partial file next to the backup', async () => {
        const directory = await directories.populated('maintenance-');
        const backups = await directories.empty('backups-');

        await new LocalMaintenance(directory, '0.1.0').createBackup(
            join(backups, 'backup.mcbackup'),
        );

        expect(await readdir(backups)).toEqual(['backup.mcbackup']);
    });
    it('refuses a new installation without writing a file', async () => {
        const directory = await directories.empty('maintenance-');
        const backups = await directories.empty('backups-');

        const result = new LocalMaintenance(directory, '0.1.0').createBackup(
            join(backups, 'backup.mcbackup'),
        );

        await expect(result).rejects.toMatchObject({ reason: 'backup-nothing' });
        expect(await readdir(backups)).toEqual([]);
    });
});
