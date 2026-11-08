import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
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

        const status = await new LocalMaintenance(directory).status();

        expect(status.administrator).toBe('admin');
    });
    it('reports a new installation without creating its database', async () => {
        const directory = await directories.empty('maintenance-');

        const status = await new LocalMaintenance(directory).status();

        expect(status.administrator).toBeNull();
        expect(existsSync(join(directory, 'application.sqlite'))).toBe(false);
    });
});

describe('local administrator recovery', () => {
    it('records the recovery in the audit log', async () => {
        const directory = await directories.populated('maintenance-');

        await new LocalMaintenance(directory).recover('recovered-password');

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

        const result = new LocalMaintenance(directory).recover('recovered-password');

        await expect(result).rejects.toMatchObject({ reason: 'administrator-missing' });
        expect(existsSync(join(directory, 'application.sqlite'))).toBe(false);
    });
});
