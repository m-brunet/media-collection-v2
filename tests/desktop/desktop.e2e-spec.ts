import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '../api/client.js';
import { RuntimeFixture, RuntimeSetup } from '../api/runtime-setup.js';
import type { ServerStatus } from '../../packages/contracts/src/http.js';
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

// The sleep blockers the main process holds, once there are `count` of them (recorded by the
// main harness instead of reaching the test computer's power settings).
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

// First launch in the real desktop window: create the protected administrator `admin`.
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

// Opens Add a book and types a title, as a person would: the form now has unsaved changes and
// blocks closing through `beforeunload` (which needs a user gesture on the page).
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

    it('closes the window with unsaved book changes once Leave without saving is chosen', async () => {
        const current = await readyDesktop();

        await editUnsavedBook(current.runtime);

        await current.runtime.send({ type: 'close-window' });
        const code = await Promise.race([current.runtime.exited, delay(10_000, 'still open')]);

        expect(code).toBe(0);
    });

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
