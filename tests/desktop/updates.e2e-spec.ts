import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RuntimeFixture } from '../api/runtime-setup.js';
import type { ElectronRuntime, RuntimeOptions } from '../api/runtime.js';
import { appVersion } from '../api/app-version.js';

let fixture: RuntimeFixture;

beforeEach(() => {
    fixture = new RuntimeFixture();
});
afterEach(async () => {
    await fixture.teardown();
});

interface Shown {
    title: string;
    message: string;
    detail?: string;
    buttons: string[];
}

interface MenuItem {
    id: string | null;
    label: string;
    enabled?: boolean;
    submenu?: MenuItem[];
}

async function evaluate(runtime: ElectronRuntime, expression: string) {
    return (await runtime.send({ type: 'evaluate', expression })).value;
}

async function until<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
    for (let attempt = 0; attempt < 200; attempt++) {
        const value = await read();

        if (done(value)) {
            return value;
        }

        await delay(50);
    }

    return read();
}

function dialogs(runtime: ElectronRuntime) {
    return async () => (await runtime.send({ type: 'dialogs' })).value as Shown[];
}

function messages(runtime: ElectronRuntime) {
    return async () => (await dialogs(runtime)()).map((shown) => shown.message);
}

function updateItem(runtime: ElectronRuntime) {
    return async () => {
        const menu = (await runtime.send({ type: 'menu-labels' })).value as MenuItem[];

        return menu[0]?.submenu?.find((item) => item.id === 'updates');
    };
}

function backups(directory: string) {
    const folder = join(directory, 'test-documents', 'Media Collection backups');

    return existsSync(folder) ? readdirSync(folder) : [];
}

async function healthy(base: string) {
    try {
        const response = await fetch(new URL('/api/health', base), {
            signal: AbortSignal.timeout(1000),
        });

        return response.ok;
    } catch {
        return false;
    }
}

async function desktopWithData(options: RuntimeOptions) {
    const first = await fixture.start(undefined, { main: true });

    await until(
        () => evaluate(first.runtime, "Boolean(document.querySelector('[name=username]'))"),
        Boolean,
    );
    await evaluate(
        first.runtime,
        "document.querySelector('[name=username]').value='admin';document.querySelector('[name=password]').value='desktop-new-password';document.querySelector('[name=confirmation]').value='desktop-new-password';document.querySelector('form').requestSubmit();true",
    );
    await until(
        () => evaluate(first.runtime, "document.querySelector('h1')?.textContent === 'Overview'"),
        Boolean,
    );

    return fixture.restart(first, { main: true, ...options });
}

describe('checking for updates', () => {
    it('says the running version is the latest from the File menu', async () => {
        const current = await fixture.start(undefined, {
            main: true,
            updates: { latest: null, system: 'windows' },
        });

        await current.runtime.send({ type: 'menu', id: 'updates' });

        const shown = await until(dialogs(current.runtime), (all) => all.length > 0);

        expect(shown).toEqual([
            {
                title: 'Media Collection update',
                message: `You have the latest version (${appVersion}).`,
                buttons: ['OK'],
            },
        ]);
    });
    it('stays silent at startup when the running version is the latest', async () => {
        const current = await fixture.start(undefined, {
            main: true,
            updates: { latest: null, system: 'windows' },
        });

        await delay(1000);

        expect(await dialogs(current.runtime)()).toEqual([]);
    });
    it('stays silent at startup when the check fails', async () => {
        const current = await fixture.start(undefined, {
            main: true,
            updates: { latest: '2.0.1', system: 'windows', failCheck: true },
        });

        await delay(1000);

        expect(await dialogs(current.runtime)()).toEqual([]);
    });
    it('offers Retry and Close when a manual check fails', async () => {
        const current = await fixture.start(undefined, {
            main: true,
            updates: { latest: '2.0.1', system: 'windows', failCheck: true },
            dialogAnswers: [1],
        });

        await current.runtime.send({ type: 'menu', id: 'updates' });

        const shown = await until(dialogs(current.runtime), (all) => all.length > 0);

        expect(shown[0]).toMatchObject({
            message: 'Media Collection could not check for updates.',
            buttons: ['Retry', 'Close'],
        });
    });
    it('offers an available update once at startup, with Download and Later on Windows', async () => {
        const current = await fixture.start(undefined, {
            main: true,
            updates: { latest: '2.0.1', system: 'windows' },
            dialogAnswers: [1],
        });

        const shown = await until(dialogs(current.runtime), (all) => all.length > 0);

        expect(shown).toEqual([
            {
                title: 'Media Collection update',
                message: 'Version 2.0.1 is available.',
                detail: 'Download it now: Media Collection keeps working while it downloads, for browsers and phones too.',
                buttons: ['Download', 'Later'],
            },
        ]);
    });
    it('is written in French on a French device', async () => {
        const current = await fixture.start(undefined, {
            main: true,
            language: 'fr-FR',
            updates: { latest: '2.0.1', system: 'windows' },
            dialogAnswers: [1],
        });

        const shown = await until(dialogs(current.runtime), (all) => all.length > 0);

        expect(shown[0]).toMatchObject({
            title: 'Mise à jour de Media Collection',
            message: 'La version 2.0.1 est disponible.',
            buttons: ['Télécharger', 'Plus tard'],
        });
    });
});

describe('Windows integrated update', () => {
    it('keeps the server answering while the update downloads', async () => {
        const current = await fixture.start(undefined, {
            main: true,
            updates: { latest: '2.0.1', system: 'windows', downloadMs: 3000 },
            dialogAnswers: [0, 1],
        });

        const item = await until(updateItem(current.runtime), (found) =>
            Boolean(found?.label.startsWith('Downloading')),
        );

        expect(item).toMatchObject({ label: 'Downloading version 2.0.1…', enabled: false });
        expect(await healthy(current.client.base)).toBe(true);
    });
    it('keeps a postponed update ready in the File menu', async () => {
        const current = await fixture.start(undefined, {
            main: true,
            updates: { latest: '2.0.1', system: 'windows' },
            dialogAnswers: [0, 1],
        });

        const item = await until(updateItem(current.runtime), (found) =>
            Boolean(found?.label.startsWith('Restart')),
        );

        expect(item).toMatchObject({ label: 'Restart and install version 2.0.1…', enabled: true });
        expect(backups(current.directory)).toEqual([]);
    });
    it('warns connected users in the Restart and install confirmation', async () => {
        const current = await fixture.start(undefined, {
            main: true,
            updates: { latest: '2.0.1', system: 'windows' },
            dialogAnswers: [0, 1],
        });

        const shown = await until(dialogs(current.runtime), (all) => all.length > 1);

        expect(shown[1]).toEqual({
            title: 'Media Collection update',
            message: 'Version 2.0.1 is ready.',
            detail: 'Media Collection saves a full backup, then restarts to install it. Browsers and phones connected to it lose access for a moment.',
            buttons: ['Restart and install', 'Later'],
        });
    });
    it('saves a full backup before installing, then quits for the installer', async () => {
        const current = await desktopWithData({ updates: { latest: '2.0.1', system: 'windows' } });

        await current.runtime.exited;

        expect(backups(current.directory)).toEqual([
            expect.stringMatching(/^Media Collection backup .* before 2\.0\.1\.mcbackup$/),
        ]);
    });
    it('installs a postponed update from the File menu', async () => {
        const current = await desktopWithData({
            updates: { latest: '2.0.1', system: 'windows' },
            dialogAnswers: [0, 1],
        });

        await until(updateItem(current.runtime), (found) =>
            Boolean(found?.label.startsWith('Restart')),
        );

        await current.runtime.send({ type: 'menu', id: 'updates' });

        await current.runtime.exited;
        expect(backups(current.directory)).toHaveLength(1);
    });
    it('installs nothing and starts the server again when a failed backup is cancelled', async () => {
        const current = await desktopWithData({
            updates: { latest: '2.0.1', system: 'windows' },
            dialogAnswers: [1],
        });

        await until(dialogs(current.runtime), (all) => all.length > 0);
        writeFileSync(
            join(current.directory, 'test-documents', 'Media Collection backups'),
            'not a folder',
        );
        await current.runtime.send({ type: 'answer-dialogs', message: [0, 0, 1] });

        await current.runtime.send({ type: 'menu', id: 'updates' });

        const shown = await until(messages(current.runtime), (all) =>
            all.includes('The backup before the update could not be saved.'),
        );

        expect(shown).toContain('The backup before the update could not be saved.');
        expect(await until(() => healthy(current.client.base), Boolean)).toBe(true);
    });
});

describe('Linux manual update', () => {
    it('offers Create backup and open download page', async () => {
        const current = await fixture.start(undefined, {
            main: true,
            updates: { latest: '2.0.1', system: 'linux' },
            dialogAnswers: [1],
        });

        const shown = await until(dialogs(current.runtime), (all) => all.length > 0);

        expect(shown[0]?.buttons).toEqual(['Create backup and open download page', 'Later']);
    });
    it('saves the backup, starts the server again, then opens the download page', async () => {
        const current = await desktopWithData({ updates: { latest: '2.0.1', system: 'linux' } });

        const opened = await until(
            async () =>
                ((await current.runtime.send({ type: 'opened' })).value as { external: string[] })
                    .external,
            (pages) => pages.length > 0,
        );

        expect(opened).toEqual([
            'https://github.com/m-brunet/media-collection-v2/releases/tag/v2.0.1',
        ]);
        expect(backups(current.directory)).toHaveLength(1);
        expect(await until(() => healthy(current.client.base), Boolean)).toBe(true);
    });
    it('leaves the download page unopened when a failed backup is cancelled', async () => {
        const current = await desktopWithData({
            updates: { latest: '2.0.1', system: 'linux' },
            dialogAnswers: [1],
        });

        await until(dialogs(current.runtime), (all) => all.length > 0);
        writeFileSync(
            join(current.directory, 'test-documents', 'Media Collection backups'),
            'not a folder',
        );
        await current.runtime.send({ type: 'answer-dialogs', message: [0, 1] });

        await current.runtime.send({ type: 'menu', id: 'updates' });

        await until(messages(current.runtime), (all) =>
            all.includes('The backup before the update could not be saved.'),
        );
        expect(
            ((await current.runtime.send({ type: 'opened' })).value as { external: string[] })
                .external,
        ).toEqual([]);
    });
});
