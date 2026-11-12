import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '../api/client.js';
import { RuntimeFixture, RuntimeSetup } from '../api/runtime-setup.js';
import type { ServerStatus } from '../../packages/contracts/src/http.js';
import type { ElectronRuntime } from '../api/runtime.js';
import { appVersion } from '../api/app-version.js';

let fixture: RuntimeFixture;
const windows = process.platform === 'win32';

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
    for (let attempt = 0; attempt < 80; attempt++) {
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

async function sleepBlockers(runtime: ElectronRuntime, count: number) {
    for (let attempt = 0; attempt < 80; attempt++) {
        const blockers = (await runtime.send({ type: 'keep-awake' })).value as string[];

        if (blockers.length === count) {
            return blockers;
        }

        await delay(50);
    }

    return (await runtime.send({ type: 'keep-awake' })).value as string[];
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

async function editUnsavedBook(runtime: ElectronRuntime) {
    await evaluate(
        runtime,
        "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Add a book').click();true",
    );
    await waitFor(runtime, "document.querySelector('h1')?.textContent === 'Add a book'");
    await runtime.send({
        type: 'evaluate',
        userGesture: true,
        expression:
            "const label = Array.from(document.querySelectorAll('label')).find(item => item.textContent.startsWith('Title'));const field = document.getElementById(label.htmlFor);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'Unsaved book');field.dispatchEvent(new Event('input', { bubbles: true }));true",
    });
}

describe('desktop lifecycle and renderer', () => {
    it('saves the external HTTP port from the actual Server settings screen', async () => {
        const current = await readyDesktop();
        const port = await RuntimeSetup.availablePort();
        const client = new Client(current.client.base);

        await client.login('admin', 'desktop-new-password');

        await evaluate(
            current.runtime,
            "Array.from(document.querySelectorAll('a')).find(link => link.textContent === 'Server settings').click();true",
        );
        await waitFor(current.runtime, "Boolean(document.querySelector('[name=httpPort]'))");
        await evaluate(
            current.runtime,
            "document.querySelector('details.advanced-settings').open = true;true",
        );
        await evaluate(
            current.runtime,
            "document.querySelector('[name=httpPort]').value='" + port + "';true",
        );

        await evaluate(
            current.runtime,
            'document.querySelector(\'form[aria-label="HTTP / web interface"]\').requestSubmit();true',
        );
        await waitFor(current.runtime, "document.body.innerText.includes('HTTP port saved.')");
        const screen = await evaluate(current.runtime, 'document.body.innerText');
        const response = await client.call<ServerStatus>('/server-settings');

        expect(response.body.configured.http.port).toBe(port);
        expect(response.body.running.httpPort).toBe(current.ready.httpPort);
        expect(response.body.configured.tls.hasCertificate).toBe(false);
        expect(response.body.restartRequired).toBe(true);
        expect(screen).toContain('restart');
        expect(screen).toContain('port override is active');
    });

    it('opens the persisted external HTTP port after reopening the desktop without overrides', async () => {
        const current = await readyDesktop();
        const client = new Client(current.client.base);

        await client.login('admin', 'desktop-new-password');
        const port = await RuntimeSetup.availablePort();

        await client.call('/server-settings/http', 'PUT', { port });

        const restarted = await fixture.restart(current, { main: true, port: null });
        const address = await evaluate(restarted.runtime, 'window.location.origin');

        expect(restarted.ready.httpPort).toBe(port);
        expect(address).toBe('http://127.0.0.1:' + port);
        expect(await (await fetch(address + '/account')).text()).toContain('<div id="root">');
    });

    it('keeps the computer awake once the keep-awake setting is turned on', async () => {
        const current = await readyDesktop();
        const client = new Client(current.client.base);

        await client.login('admin', 'desktop-new-password');

        await client.call('/server-settings/keep-awake', 'PUT', { enabled: true });

        expect(await sleepBlockers(current.runtime, 1)).toEqual(['prevent-app-suspension']);
    });

    it('lets the computer sleep again once the keep-awake setting is turned off', async () => {
        const current = await readyDesktop();
        const client = new Client(current.client.base);

        await client.login('admin', 'desktop-new-password');
        await client.call('/server-settings/keep-awake', 'PUT', { enabled: true });
        await sleepBlockers(current.runtime, 1);

        await client.call('/server-settings/keep-awake', 'PUT', { enabled: false });

        expect(await sleepBlockers(current.runtime, 0)).toEqual([]);
    });

    it('keeps the computer awake from startup when the setting was saved on', async () => {
        const current = await readyDesktop();
        const client = new Client(current.client.base);

        await client.login('admin', 'desktop-new-password');
        await client.call('/server-settings/keep-awake', 'PUT', { enabled: true });

        const restarted = await fixture.restart(current, { main: true });

        expect(await sleepBlockers(restarted.runtime, 1)).toEqual(['prevent-app-suspension']);
    });

    it('starts a sandboxed renderer without a business or maintenance bridge', async () => {
        const options = { main: true };

        const current = await fixture.start(undefined, options);
        const bridge = await evaluate(
            current.runtime,
            "typeof window.require + ':' + typeof window.maintenance",
        );

        expect(current.ready.value).toMatchObject({
            nodeIntegration: false,
            sandbox: true,
            contextIsolation: true,
            maintenance: false,
        });
        expect(bridge).toBe('undefined:undefined');
    });

    it('completes first-launch setup through the React screen', async () => {
        const current = await fixture.start(undefined, { main: true });

        await waitFor(
            current.runtime,
            "document.querySelector('h1')?.textContent === 'Set up your library'",
        );
        await evaluate(
            current.runtime,
            "document.querySelector('[name=username]').value='admin';document.querySelector('[name=password]').value='desktop-new-password';document.querySelector('[name=confirmation]').value='desktop-new-password';true",
        );

        await evaluate(current.runtime, "document.querySelector('form').requestSubmit();true");
        await waitFor(current.runtime, "document.querySelector('h1')?.textContent === 'Overview'");
        const title = await evaluate(current.runtime, "document.querySelector('h1').textContent");

        expect(title).toBe('Overview');
    });

    it('saves the interface language from the actual React screen', async () => {
        const current = await readyDesktop();
        const client = new Client('http://127.0.0.1:' + current.ready.httpPort);

        await client.login('admin', 'desktop-new-password');

        await evaluate(
            current.runtime,
            "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Français').click();true",
        );
        await waitFor(
            current.runtime,
            "document.querySelector('h1')?.textContent === 'Vue d’ensemble'",
        );
        const response = await client.call<{ language: string }>('/auth/me');

        expect(response.status).toBe(200);
        expect(response.body.language).toBe('fr');
    });

    it('opens a Media Collection window that cannot shrink below 1280 x 720', async () => {
        const options = { main: true };

        const current = await fixture.start(undefined, options);

        expect(current.ready.value).toMatchObject({
            minimumSize: [1280, 720],
            applicationName: 'Media Collection',
        });
    });

    it('rejects a maintenance instance while the normal desktop is running', async () => {
        const current = await readyDesktop();
        const client = new Client('http://127.0.0.1:' + current.ready.httpPort);

        const duplicate = fixture.launch(current.directory, { main: true, maintenance: true });

        await expect(duplicate.ready).rejects.toThrow('already running');
        expect(await duplicate.exited).toBe(1);
        expect((await client.call('/health')).status).toBe(200);
    });

    it.skipIf(windows)(
        'closes the window with unsaved book changes once Leave without saving is chosen',
        async () => {
            const current = await readyDesktop();

            await editUnsavedBook(current.runtime);

            await current.runtime.send({ type: 'close-window' });
            const code = await Promise.race([current.runtime.exited, delay(10_000, 'still open')]);

            expect(code).toBe(0);
        },
    );

    it('quits and stops HTTP with unsaved book changes once Leave without saving is chosen', async () => {
        const current = await readyDesktop();
        const client = new Client('http://127.0.0.1:' + current.ready.httpPort);

        await editUnsavedBook(current.runtime);

        await current.runtime.send({ type: 'quit' });
        const code = await Promise.race([current.runtime.exited, delay(10_000, 'still open')]);

        expect(code).toBe(0);
        await expect(client.call('/health')).rejects.toThrow();
    });

    it('keeps the window and HTTP running when Stay is chosen on quit with unsaved book changes', async () => {
        const current = await readyDesktop();
        const client = new Client('http://127.0.0.1:' + current.ready.httpPort);

        await editUnsavedBook(current.runtime);
        await current.runtime.send({ type: 'answer-dialogs', message: [1] });

        await current.runtime.send({ type: 'quit' });
        const code = await Promise.race([current.runtime.exited, delay(3_000, 'still open')]);

        expect(code).toBe('still open');
        expect((await client.call('/health')).status).toBe(200);
        expect(await evaluate(current.runtime, "document.querySelector('h1')?.textContent")).toBe(
            'Add a book',
        );
    });

    it('stops HTTP when the desktop shuts down', async () => {
        const current = await readyDesktop();
        const client = new Client('http://127.0.0.1:' + current.ready.httpPort);

        await current.runtime.close();

        await expect(client.call('/health')).rejects.toThrow();
    });
});

interface MenuLabel {
    id: string | null;
    label: string;
    role?: string;
    enabled?: boolean;
    checked?: boolean;
    type: string;
    submenu?: MenuLabel[];
}

async function menuLabels(runtime: ElectronRuntime) {
    return (await runtime.send({ type: 'menu-labels' })).value as MenuLabel[];
}

interface Opened {
    paths: string[];
    external: string[];
}

async function shownDialogs(runtime: ElectronRuntime, count: number) {
    for (let attempt = 0; attempt < 80; attempt++) {
        const dialogs = (await runtime.send({ type: 'dialogs' })).value as unknown[];

        if (dialogs.length >= count) {
            return dialogs;
        }

        await delay(50);
    }

    return (await runtime.send({ type: 'dialogs' })).value as unknown[];
}

async function setupPage(language?: string) {
    const current = await fixture.start(undefined, { main: true, language });

    await waitFor(current.runtime, "Boolean(document.querySelector('[name=username]'))");

    return current;
}

describe('application menu', () => {
    it('has only the File, View and Maintenance menus', async () => {
        const current = await setupPage();

        const menu = await menuLabels(current.runtime);

        expect(menu.map((item) => item.label)).toEqual(['File', 'View', 'Maintenance']);
    });
    it('offers About, Check for updates, Launch at startup on Windows, the configuration file and Exit in the File menu', async () => {
        const current = await setupPage();

        const menu = await menuLabels(current.runtime);

        expect(menu[0]?.submenu?.map((item) => item.label)).toEqual([
            'About Media Collection',
            'Check for updates…',
            ...(windows ? ['Launch at startup'] : []),
            'Open configuration file…',
            '',
            'Exit',
        ]);
        expect(menu[0]?.submenu?.at(-1)).toMatchObject({
            id: 'exit',
            label: 'Exit',
            role: 'quit',
            type: 'normal',
        });
    });
    it('shows Check for updates disabled outside a packaged application', async () => {
        const current = await setupPage();

        const menu = await menuLabels(current.runtime);

        expect(menu[0]?.submenu?.find((item) => item.id === 'updates')).toMatchObject({
            label: 'Check for updates…',
            enabled: false,
        });
    });
    it('labels the menus in French on a French device', async () => {
        const current = await setupPage('fr-FR');

        const menu = await menuLabels(current.runtime);

        expect(menu.map((item) => item.label)).toEqual(['Fichier', 'Affichage', 'Maintenance']);
        expect(menu[0]?.submenu?.map((item) => item.label)).toEqual([
            'À propos de Media Collection',
            'Rechercher des mises à jour…',
            ...(windows ? ['Lancer au démarrage'] : []),
            'Ouvrir le fichier de configuration…',
            '',
            'Quitter',
        ]);
        expect(menu[1]?.submenu?.map((item) => item.label)).toEqual([
            'Actualiser',
            'Forcer l’actualisation',
            'Outils de développement',
            '',
            'Taille réelle',
            'Zoom avant',
            'Zoom arrière',
            '',
            'Plein écran',
        ]);
    });
    it('creates and opens the configuration file from File, Open configuration file', async () => {
        const current = await setupPage();
        const path = join(current.directory, 'config.json');

        await current.runtime.send({ type: 'menu', id: 'open-configuration' });

        expect(await shownDialogs(current.runtime, 1)).toEqual([
            {
                title: 'Configuration file',
                message: 'Changes apply the next time Media Collection starts.',
                detail: path,
                buttons: ['OK'],
            },
        ]);
        expect(((await current.runtime.send({ type: 'opened' })).value as Opened).paths).toEqual([
            path,
        ]);
        expect(await readFile(path, 'utf8')).toBe('{}\n');
    });
    it('keeps the content of an existing configuration file when opening it', async () => {
        const current = await setupPage();
        const path = join(current.directory, 'config.json');

        await writeFile(path, '{ "host": "0.0.0.0" }');

        await current.runtime.send({ type: 'menu', id: 'open-configuration' });

        await shownDialogs(current.runtime, 1);
        expect(await readFile(path, 'utf8')).toBe('{ "host": "0.0.0.0" }');
    });
    it('quits the application from File, Exit', async () => {
        const current = await setupPage();

        await current.runtime.send({ type: 'menu', id: 'exit' });

        await current.runtime.exited;
        await expect(current.client.call('/health')).rejects.toThrow();
    });
    it('selects all the text of a field with Ctrl+A without an Edit menu', async () => {
        const current = await setupPage();

        await evaluate(
            current.runtime,
            "const field=document.querySelector('[name=username]');field.value='librarian';field.focus();field.setSelectionRange(0,0);true",
        );

        await current.runtime.send({ type: 'key', keyCode: 'A', modifiers: ['control'] });

        await waitFor(
            current.runtime,
            "document.querySelector('[name=username]').selectionEnd === 'librarian'.length",
        );
        expect(
            await evaluate(
                current.runtime,
                "document.querySelector('[name=username]').selectionStart",
            ),
        ).toBe(0);
    });
});

interface TrayState {
    menu: MenuLabel[] | null;
    balloons: { title: string; content: string }[];
}

async function trayState(runtime: ElectronRuntime) {
    return (await runtime.send({ type: 'tray' })).value as TrayState;
}

async function loginItem(runtime: ElectronRuntime) {
    return (await runtime.send({ type: 'login-item' })).value;
}

function fileItem(menu: MenuLabel[], id: string) {
    return menu[0]?.submenu?.find((item) => item.id === id);
}

describe.runIf(windows)('tray and launch at startup', () => {
    it('offers Open Libris, Launch at startup and Quit in the tray menu', async () => {
        const current = await setupPage();

        const tray = await trayState(current.runtime);

        expect(tray.menu?.map((item) => item.label)).toEqual([
            'Open Libris',
            'Launch at startup',
            '',
            'Quit',
        ]);
    });
    it('labels the tray menu in French on a French device', async () => {
        const current = await setupPage('fr-FR');

        const tray = await trayState(current.runtime);

        expect(tray.menu?.map((item) => item.label)).toEqual([
            'Ouvrir Libris',
            'Lancer au démarrage',
            '',
            'Quitter',
        ]);
    });
    it('starts with launch at startup turned off', async () => {
        const current = await setupPage();

        const menu = await menuLabels(current.runtime);

        expect(fileItem(menu, 'launch-at-startup')).toMatchObject({
            type: 'checkbox',
            checked: false,
            enabled: true,
        });
        expect(await loginItem(current.runtime)).toMatchObject({ openAtLogin: false });
    });
    it('registers a hidden start at sign-in from File, Launch at startup', async () => {
        const current = await setupPage();

        await current.runtime.send({ type: 'menu', id: 'launch-at-startup' });

        expect(await loginItem(current.runtime)).toEqual({
            openAtLogin: true,
            args: ['--hidden'],
            name: 'Media Collection',
        });
    });
    it('ticks Launch at startup in the tray once turned on from the File menu', async () => {
        const current = await setupPage();

        await current.runtime.send({ type: 'menu', id: 'launch-at-startup' });

        const tray = await trayState(current.runtime);

        expect(tray.menu?.find((item) => item.id === 'launch-at-startup')?.checked).toBe(true);
    });
    it('turns launch at startup off again from the tray', async () => {
        const current = await setupPage();

        await current.runtime.send({ type: 'menu', id: 'launch-at-startup' });

        await current.runtime.send({ type: 'tray-menu', id: 'launch-at-startup' });

        expect(await loginItem(current.runtime)).toMatchObject({ openAtLogin: false });
        expect(fileItem(await menuLabels(current.runtime), 'launch-at-startup')?.checked).toBe(
            false,
        );
    });
    it('runs the server when started hidden at sign-in', async () => {
        const current = await fixture.start(undefined, { main: true, arguments: ['--hidden'] });

        const response = await current.client.call('/health');

        expect(response.status).toBe(200);
        expect((await trayState(current.runtime)).menu).not.toBeNull();
    });
    it('keeps the server running in the tray when the window is closed', async () => {
        const current = await readyDesktop();

        await current.runtime.send({ type: 'close-window' });
        const code = await Promise.race([current.runtime.exited, delay(3_000, 'still open')]);

        expect(code).toBe('still open');
        expect((await current.client.call('/health')).status).toBe(200);
    });
    it('tells once that Media Collection keeps running when the window is first closed', async () => {
        const current = await readyDesktop();

        await current.runtime.send({ type: 'close-window' });
        await current.runtime.send({ type: 'tray-click' });

        await current.runtime.send({ type: 'close-window' });

        expect((await trayState(current.runtime)).balloons).toEqual([
            {
                title: 'Media Collection',
                content: 'Media Collection keeps running for Leaf. Quit from the tray icon.',
            },
        ]);
    });
    it('does not tell again after the application starts again', async () => {
        const current = await readyDesktop();

        await current.runtime.send({ type: 'close-window' });
        const restarted = await fixture.restart(current, { main: true });

        await restarted.runtime.send({ type: 'close-window' });

        expect((await trayState(restarted.runtime)).balloons).toEqual([]);
    });
    it('keeps unsaved book changes without asking when the window is closed to the tray', async () => {
        const current = await readyDesktop();

        await editUnsavedBook(current.runtime);

        await current.runtime.send({ type: 'close-window' });

        expect((await current.runtime.send({ type: 'dialogs' })).value).toEqual([]);
        expect(await evaluate(current.runtime, "document.querySelector('h1')?.textContent")).toBe(
            'Add a book',
        );
    });
    it('quits and stops HTTP from the tray Quit', async () => {
        const current = await readyDesktop();

        await current.runtime.send({ type: 'tray-menu', id: 'quit' });

        expect(await current.runtime.exited).toBe(0);
        await expect(current.client.call('/health')).rejects.toThrow();
    });
});

describe('About window', () => {
    async function aboutWindow(language?: string) {
        const current = await setupPage(language);

        await current.runtime.send({ type: 'menu', id: 'about' });
        await waitFor(current.runtime, "Boolean(document.getElementById('version')?.textContent)");

        return current;
    }

    async function opened(runtime: ElectronRuntime) {
        const read = async () =>
            ((await runtime.send({ type: 'opened' })).value as { external: string[] }).external;

        for (let attempt = 0; attempt < 80 && (await read()).length === 0; attempt++) {
            await delay(50);
        }

        return read();
    }

    async function windowAddresses(runtime: ElectronRuntime) {
        const windows = (await runtime.send({ type: 'windows' })).value as { url: string }[];

        return windows.map((each) => each.url);
    }

    async function waitForWindowAt(runtime: ElectronRuntime, url: string) {
        for (let attempt = 0; attempt < 80; attempt++) {
            if ((await windowAddresses(runtime)).includes(url)) {
                return;
            }

            await delay(50);
        }
    }

    it('shows the name and the running version', async () => {
        const current = await aboutWindow();

        const shown = await evaluate(
            current.runtime,
            "document.querySelector('h1').textContent + ' ' + document.getElementById('version').textContent",
        );

        expect(shown).toBe(`Media Collection Version ${appVersion}`);
    });
    it('opens the source code in the default browser', async () => {
        const current = await aboutWindow();

        await evaluate(
            current.runtime,
            "document.querySelector('[data-target=repository]').click();true",
        );

        expect(await opened(current.runtime)).toEqual([
            'https://github.com/m-brunet/media-collection-v2',
        ]);
    });
    it('opens the licence in the default browser', async () => {
        const current = await aboutWindow();

        await evaluate(
            current.runtime,
            "document.querySelector('[data-target=licence]').click();true",
        );

        expect(await opened(current.runtime)).toEqual([
            'https://github.com/m-brunet/media-collection-v2/blob/master/LICENSE',
        ]);
    });
    it('shows the credits page in the Libris window', async () => {
        const current = await aboutWindow();
        const credits = new URL('/credits', current.client.base).href;

        await evaluate(current.runtime, "document.getElementById('credits').click();true");

        await waitForWindowAt(current.runtime, credits);
        expect(await windowAddresses(current.runtime)).toContain(credits);
    });
    it('opens a single About window', async () => {
        const current = await aboutWindow();

        await current.runtime.send({ type: 'menu', id: 'about' });

        await delay(200);
        expect(
            (await windowAddresses(current.runtime)).filter((url) => url.endsWith('about.html')),
        ).toHaveLength(1);
    });
    it('is written in French on a French device', async () => {
        const current = await aboutWindow('fr-FR');

        const texts = await evaluate(
            current.runtime,
            "document.title + ' | ' + document.getElementById('credits').textContent",
        );

        expect(texts).toBe('À propos de Media Collection | Crédits et licences');
    });
});
