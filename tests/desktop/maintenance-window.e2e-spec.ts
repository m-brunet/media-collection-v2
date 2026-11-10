import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '../api/client.js';
import { RuntimeFixture } from '../api/runtime-setup.js';
import type { ElectronRuntime } from '../api/runtime.js';

let fixture: RuntimeFixture;

beforeEach(() => {
    fixture = new RuntimeFixture();
});
afterEach(async () => {
    await fixture.teardown();
});

async function evaluate(runtime: ElectronRuntime, expression: string) {
    return (await runtime.send({ type: 'evaluate', expression })).value;
}

async function waitFor(runtime: ElectronRuntime, expression: string) {
    for (let attempt = 0; attempt < 120; attempt++) {
        if (await evaluate(runtime, expression)) {
            return;
        }

        await delay(50);
    }

    throw new Error(
        'Desktop UI did not reach expected state: ' +
            String(await evaluate(runtime, 'document.body.innerText')),
    );
}

async function waitForWindow(runtime: ElectronRuntime, protocol: 'file:' | 'http:') {
    for (let attempt = 0; attempt < 200; attempt++) {
        const url = ((await runtime.send({ type: 'window' })).value as { url: string | null }).url;

        if (url?.startsWith(protocol)) {
            return;
        }

        await delay(50);
    }

    throw new Error('The ' + protocol + ' window did not open.');
}

function text(id: string) {
    return 'document.getElementById(' + JSON.stringify(id) + ').textContent';
}

async function readyDesktop() {
    const current = await fixture.start(undefined, { main: true });

    await waitFor(
        current.runtime,
        "document.querySelector('h1')?.textContent === 'Set up your library'",
    );
    await evaluate(
        current.runtime,
        "document.querySelector('[name=username]').value='admin';document.querySelector('[name=password]').value='desktop-new-password';document.querySelector('[name=confirmation]').value='desktop-new-password';document.querySelector('form').requestSubmit();true",
    );
    await waitFor(current.runtime, "document.querySelector('h1')?.textContent === 'Overview'");

    return current;
}

async function maintenanceDesktop() {
    const previous = await readyDesktop();

    await previous.runtime.close();
    const current = await fixture.start(previous.directory, { main: true, maintenance: true });

    await waitFor(current.runtime, text('recovery-account') + ".includes('admin')");

    return { previous, current };
}

async function fillRecovery(runtime: ElectronRuntime, password: string) {
    await evaluate(
        runtime,
        "document.getElementById('password').value=" +
            JSON.stringify(password) +
            ";document.getElementById('confirmation').value=" +
            JSON.stringify(password) +
            ';true',
    );
}

async function createdBackup(runtime: ElectronRuntime, directory: string) {
    const file = join(directory, 'test-documents', 'library.mcbackup');

    await runtime.send({ type: 'answer-dialogs', save: [file] });
    await evaluate(runtime, "document.getElementById('create-backup').click();true");
    await waitFor(runtime, text('backup-result') + ".startsWith('Backup saved')");

    return file;
}

async function chosenBackup(runtime: ElectronRuntime, file: string) {
    await runtime.send({ type: 'answer-dialogs', open: [file] });
    await evaluate(runtime, "document.getElementById('choose-backup').click();true");
    await waitFor(
        runtime,
        "!document.getElementById('restore-choice').hidden || " +
            text('restore-result') +
            '.length > 0',
    );
}

describe('local maintenance window', () => {
    it('opens a sandboxed local page with only the maintenance bridge and no listener', async () => {
        const previous = await readyDesktop();

        await previous.runtime.close();
        const client = new Client('http://127.0.0.1:' + previous.ready.httpPort);

        const current = await fixture.start(previous.directory, { main: true, maintenance: true });
        const bridge = await evaluate(
            current.runtime,
            "typeof window.require + ':' + Object.keys(window.maintenance).sort().join(',')",
        );

        expect(current.ready.value).toMatchObject({
            nodeIntegration: false,
            sandbox: true,
            contextIsolation: true,
            maintenance: true,
        });
        expect(bridge).toBe(
            'undefined:chooseBackup,createBackup,language,openBackupFolder,openReleases,recover,restoreBackup,status',
        );
        await expect(client.call('/health')).rejects.toThrow();
    });
    it('names the protected Admin', async () => {
        const { current } = await maintenanceDesktop();

        const account = await evaluate(current.runtime, text('recovery-account'));

        expect(account).toContain('Admin account: admin.');
    });
    it('offers no recovery or backup on a new installation', async () => {
        const current = await fixture.start(undefined, { main: true, maintenance: true });

        await waitFor(current.runtime, text('recovery-account') + ".includes('no Admin')");
        const state = await evaluate(
            current.runtime,
            "[document.getElementById('recovery-form').hidden, document.getElementById('create-backup').disabled, document.getElementById('choose-backup').disabled].join(',')",
        );

        expect(state).toBe('true,true,false');
    });
    it('reports a successful Admin recovery', async () => {
        const { current } = await maintenanceDesktop();

        await fillRecovery(current.runtime, 'dialog-recovery-password');

        await evaluate(
            current.runtime,
            "document.getElementById('recovery-form').requestSubmit();true",
        );

        await waitFor(
            current.runtime,
            text('recovery-result') + ".startsWith('Password reset for admin.')",
        );
    });
    it('keeps the recovered temporary password for the next sign-in', async () => {
        const { current } = await maintenanceDesktop();

        await fillRecovery(current.runtime, 'dialog-recovery-password');
        await evaluate(
            current.runtime,
            "document.getElementById('recovery-form').requestSubmit();true",
        );
        await waitFor(current.runtime, text('recovery-result') + ".startsWith('Password reset')");
        await current.runtime.close();
        const restarted = await fixture.start(current.directory, { main: true });
        const client = new Client('http://127.0.0.1:' + restarted.ready.httpPort);

        await client.prepare();

        const response = await client.call('/auth/login', 'POST', {
            username: 'admin',
            password: 'dialog-recovery-password',
        });

        expect(response.status).toBe(200);
        expect(response.body.mustChangePassword).toBe(true);
    });
    it('refuses different repeated passwords', async () => {
        const { current } = await maintenanceDesktop();

        await evaluate(
            current.runtime,
            "document.getElementById('password').value='first-password';document.getElementById('confirmation').value='second-password';document.getElementById('recovery-form').requestSubmit();true",
        );

        expect(await evaluate(current.runtime, text('recovery-result'))).toBe(
            'The passwords must match.',
        );
    });
    it('saves a backup where the save dialog points', async () => {
        const { current } = await maintenanceDesktop();

        const file = await createdBackup(current.runtime, current.directory);

        expect(existsSync(file)).toBe(true);
        expect(await evaluate(current.runtime, text('backup-result'))).toBe(
            'Backup saved: ' + file,
        );
    });
    it('creates the backup folder in Documents for the save dialog', async () => {
        const { current } = await maintenanceDesktop();

        await current.runtime.send({ type: 'answer-dialogs', save: [] });
        await evaluate(current.runtime, "document.getElementById('create-backup').click();true");

        expect(
            existsSync(join(current.directory, 'test-documents', 'Media Collection backups')),
        ).toBe(true);
    });
    it('describes a chosen backup before restoring it', async () => {
        const { current } = await maintenanceDesktop();
        const file = await createdBackup(current.runtime, current.directory);

        await chosenBackup(current.runtime, file);

        const summary = await evaluate(
            current.runtime,
            '[' +
                ['summary-version', 'summary-books', 'summary-accounts']
                    .map((id) => text(id))
                    .join(',') +
                "].join('|')",
        );

        expect(summary).toBe('0.1.0|0|1');
    });
    it('requires the confirmation before restoring', async () => {
        const { current } = await maintenanceDesktop();
        const file = await createdBackup(current.runtime, current.directory);

        await chosenBackup(current.runtime, file);

        const disabled = await evaluate(
            current.runtime,
            "document.getElementById('restore-backup').disabled",
        );

        expect(disabled).toBe(true);
    });
    it('restores a confirmed backup', async () => {
        const { current } = await maintenanceDesktop();
        const file = await createdBackup(current.runtime, current.directory);

        await chosenBackup(current.runtime, file);

        await evaluate(
            current.runtime,
            "document.getElementById('restore-confirm').click();document.getElementById('restore-backup').click();true",
        );

        await waitFor(current.runtime, text('restore-result') + ".startsWith('Backup restored.')");
    });
    it('rejects a file that is not a backup', async () => {
        const { current } = await maintenanceDesktop();
        const file = join(current.directory, 'test-documents', 'notes.mcbackup');

        await writeFile(file, 'not a backup');

        await chosenBackup(current.runtime, file);

        expect(await evaluate(current.runtime, text('restore-result'))).toBe(
            'This file is not a Media Collection backup.',
        );
    });
    it('switches to French', async () => {
        const { current } = await maintenanceDesktop();

        await evaluate(
            current.runtime,
            "const select=document.getElementById('language');select.value='fr';select.dispatchEvent(new Event('change'));true",
        );

        expect(await evaluate(current.runtime, "document.querySelector('h1').textContent")).toBe(
            'Maintenance locale',
        );
    });
});

describe('local maintenance from the application menu', () => {
    it('stops the server and opens the maintenance window', async () => {
        const current = await readyDesktop();
        const client = new Client('http://127.0.0.1:' + current.ready.httpPort);

        await current.runtime.send({ type: 'menu', id: 'local-maintenance' });

        await waitForWindow(current.runtime, 'file:');
        await waitFor(
            current.runtime,
            "document.querySelector('h1').textContent === 'Local maintenance'",
        );
        await expect(client.call('/health')).rejects.toThrow();
    });
    it('starts the application again once maintenance is closed', async () => {
        const current = await readyDesktop();
        const client = new Client('http://127.0.0.1:' + current.ready.httpPort);

        await current.runtime.send({ type: 'menu', id: 'local-maintenance' });
        await waitForWindow(current.runtime, 'file:');
        await waitFor(current.runtime, text('recovery-account') + ".includes('admin')");

        await current.runtime.send({ type: 'close-window' });

        await waitForWindow(current.runtime, 'http:');
        await waitFor(current.runtime, "document.querySelector('h1')?.textContent === 'Overview'");
        expect((await client.call('/health')).status).toBe(200);
    });
    it('returns to the sign-in page after a restore', async () => {
        const current = await readyDesktop();

        await current.runtime.send({ type: 'menu', id: 'local-maintenance' });
        await waitForWindow(current.runtime, 'file:');
        await waitFor(current.runtime, text('recovery-account') + ".includes('admin')");
        const file = await createdBackup(current.runtime, current.directory);

        await chosenBackup(current.runtime, file);
        await evaluate(
            current.runtime,
            "document.getElementById('restore-confirm').click();document.getElementById('restore-backup').click();true",
        );
        await waitFor(current.runtime, text('restore-result') + ".startsWith('Backup restored.')");

        await current.runtime.send({ type: 'close-window' });

        await waitForWindow(current.runtime, 'http:');
        await waitFor(current.runtime, "document.querySelector('h1')?.textContent === 'Sign in'");
    });
});

describe('desktop texts on a French device', () => {
    async function frenchDesktop() {
        const current = await fixture.start(undefined, { main: true, language: 'fr-FR' });

        await waitForWindow(current.runtime, 'http:');

        return current;
    }

    it('labels the maintenance menu in French', async () => {
        const current = await frenchDesktop();

        const menu = (await current.runtime.send({ type: 'menu-labels' })).value as {
            label: string;
            submenu?: { id: string; label: string }[];
        }[];

        const maintenance = menu.find((item) => item.label === 'Maintenance');

        expect(maintenance?.submenu?.[0]).toMatchObject({
            id: 'local-maintenance',
            label: 'Ouvrir la maintenance locale…',
        });
    });
    it('asks in French before opening maintenance', async () => {
        const current = await frenchDesktop();

        await current.runtime.send({ type: 'menu', id: 'local-maintenance' });

        await waitForWindow(current.runtime, 'file:');
        const dialogs = (await current.runtime.send({ type: 'dialogs' })).value;

        expect(dialogs).toEqual([
            {
                title: 'Maintenance locale',
                message: 'Ouvrir la maintenance locale ?',
                buttons: ['Arrêter le serveur et ouvrir la maintenance', 'Annuler'],
            },
        ]);
    });
    it('opens the maintenance window in the device language', async () => {
        const current = await fixture.start(undefined, {
            main: true,
            maintenance: true,
            language: 'fr-FR',
        });

        await waitFor(current.runtime, "document.querySelector('h1').textContent !== ''");

        expect(await evaluate(current.runtime, "document.querySelector('h1').textContent")).toBe(
            'Maintenance locale',
        );
        expect(await evaluate(current.runtime, 'document.title')).toBe(
            'Media Collection · Maintenance locale',
        );
    });
});

describe('backup folder and failed updates in the maintenance window', () => {
    async function maintenanceOnly() {
        const current = await fixture.start(undefined, { main: true, maintenance: true });

        await waitFor(current.runtime, "document.querySelector('h1').textContent !== ''");

        return current;
    }

    async function opened(runtime: ElectronRuntime) {
        return (await runtime.send({ type: 'opened' })).value as {
            paths: string[];
            external: string[];
        };
    }

    it('opens the backup folder, creating it when missing', async () => {
        const current = await maintenanceOnly();
        const folder = join(current.directory, 'test-documents', 'Media Collection backups');

        await evaluate(
            current.runtime,
            "document.getElementById('open-backup-folder').click();true",
        );

        await waitFor(current.runtime, "!document.getElementById('open-backup-folder').disabled");
        expect((await opened(current.runtime)).paths).toEqual([folder]);
        expect(existsSync(folder)).toBe(true);
    });
    it('opens the releases page from After a failed update', async () => {
        const current = await maintenanceOnly();

        await evaluate(current.runtime, "document.getElementById('open-releases').click();true");

        await waitFor(current.runtime, "!document.getElementById('open-releases').disabled");
        expect((await opened(current.runtime)).external).toEqual([
            'https://github.com/m-brunet/media-collection-v2/releases',
        ]);
    });
    it('lists the recovery steps after a failed update', async () => {
        const current = await maintenanceOnly();

        const steps = await evaluate(
            current.runtime,
            "Array.from(document.querySelectorAll('#failed-update li')).map((step) => step.textContent)",
        );

        expect(steps).toEqual([
            'Download the version you had before from the releases page and install it.',
            'If Media Collection does not start, open this window with the Media Collection maintenance shortcut, or by starting Media Collection with --maintenance.',
            'Restore the backup made before the update: its name ends with “before” and the new version number.',
        ]);
    });
});
