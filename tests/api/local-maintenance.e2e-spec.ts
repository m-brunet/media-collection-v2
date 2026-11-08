import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { RuntimeFixture, RuntimeSetup } from './runtime-setup.js';
import { desktopWindow } from './client.js';

let fixture: RuntimeFixture;

beforeEach(() => {
    fixture = new RuntimeFixture();
});
afterEach(async () => {
    await fixture.teardown();
});

// A library with the Admin and a tag, saved to a backup by the maintenance worker.
async function backedUpLibrary() {
    const source = await fixture.start();

    await RuntimeSetup.administrator(source.client);
    await source.client.call('/tags', 'POST', { name: 'Signed copies' });
    const session = source.client.cookies.get('app_auth');

    await source.runtime.close();
    const maintenance = await fixture.start(source.directory, { recovery: true });
    const backup = join(await fixture.directory(), 'library.mcbackup');

    await maintenance.runtime.send({
        type: 'backup',
        dataDirectory: source.directory,
        version: '0.1.0',
        destination: backup,
    });
    await maintenance.runtime.close();

    return { backup, directory: source.directory, session };
}

// Another installation with its own Admin, closed for maintenance.
async function otherInstallation() {
    const target = await fixture.start();

    await target.client.prepare();
    await target.client.call(
        '/setup',
        'POST',
        { username: 'someone', password: 'someone-else-password' },
        { headers: desktopWindow },
    );
    await target.runtime.close();

    return { directory: target.directory };
}

async function restore(directory: string, backup: string) {
    const maintenance = await fixture.start(directory, { recovery: true });
    const response = await maintenance.runtime.send({
        type: 'restore-backup',
        dataDirectory: directory,
        version: '0.1.0',
        source: backup,
    });

    await maintenance.runtime.close();

    return response;
}

describe('local backup and restore through the Electron worker', () => {
    it('signs in with the backed-up Admin password after a restore', async () => {
        const { backup } = await backedUpLibrary();
        const target = await otherInstallation();

        await restore(target.directory, backup);
        const restarted = await fixture.start(target.directory);

        await restarted.client.prepare();

        const response = await restarted.client.call('/auth/login', 'POST', {
            username: 'admin',
            password: 'administrator-new-password',
        });

        expect(response.status).toBe(200);
    });
    it('serves the backed-up library after a restore', async () => {
        const { backup } = await backedUpLibrary();
        const target = await otherInstallation();

        await restore(target.directory, backup);
        const restarted = await fixture.start(target.directory);

        await restarted.client.login('admin', 'administrator-new-password');

        const response = await restarted.client.call<{ name: string }[]>('/tags');

        expect(response.body.map((tag) => tag.name)).toEqual(['Signed copies']);
    });
    it('ends the sessions signed before the restore, even of backed-up accounts', async () => {
        const library = await backedUpLibrary();

        await restore(library.directory, library.backup);
        const restarted = await fixture.start(library.directory);

        restarted.client.cookies.set('app_auth', library.session!);

        const response = await restarted.client.call('/auth/me');

        expect(response.status).toBe(401);
    });
    it('refuses the replaced installation accounts', async () => {
        const { backup } = await backedUpLibrary();
        const target = await otherInstallation();

        await restore(target.directory, backup);
        const restarted = await fixture.start(target.directory);

        await restarted.client.prepare();

        const response = await restarted.client.call('/auth/login', 'POST', {
            username: 'someone',
            password: 'someone-else-password',
        });

        expect(response.status).toBe(401);
    });
    it('reports the restored backup', async () => {
        const { backup } = await backedUpLibrary();
        const target = await otherInstallation();

        const response = await restore(target.directory, backup);

        expect(response).toMatchObject({
            type: 'restored',
            backup: { version: '0.1.0', contents: { books: 0, accounts: 1 } },
        });
    });
    it('rejects a backup of another version', async () => {
        const { backup } = await backedUpLibrary();
        const target = await otherInstallation();
        const maintenance = await fixture.start(target.directory, { recovery: true });

        const result = maintenance.runtime.send({
            type: 'restore-backup',
            dataDirectory: target.directory,
            version: '0.2.0',
            source: backup,
        });

        await expect(result).rejects.toThrow('only a backup made by version 0.2.0');
    });
});
