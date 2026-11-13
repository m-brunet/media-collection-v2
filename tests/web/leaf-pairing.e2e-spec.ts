import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import type { Page } from 'playwright';
import type { ServerStatus } from '../../packages/contracts/src/http.js';
import { RuntimeFixture, RuntimeSetup } from '../api/runtime-setup.js';
import { BrowserFixture, capture, viewports } from './browser.js';
import { readQrCode } from './qr-reader.js';

const browser = new BrowserFixture();
const runtime = new RuntimeFixture();

beforeAll(async () => {
    await browser.launch();
});
afterAll(async () => {
    await browser.close();
});
afterEach(async () => {
    await browser.closeContexts();
    await runtime.teardown();
});

async function scannedLink(): Promise<{ address: string; link: string }> {
    const started = await runtime.start();

    await RuntimeSetup.administrator(started.client);
    await started.client.call('/auth/login', 'POST', {
        username: 'admin',
        password: 'administrator-new-password',
    });
    const settings = await started.client.call<ServerStatus>('/server-settings');
    const address = settings.body.running.addresses.find(
        (candidate) => !candidate.startsWith('http://127.'),
    );

    if (!address) {
        throw new Error('The test computer needs a network address other than loopback.');
    }

    const page = await browser.page(started.client.base, { viewport: viewports.referenceDesktop });

    await page.goto('/');
    await page.getByLabel(/^Username/).fill('admin');
    await page.getByLabel(/^Password/).fill('administrator-new-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    await page.getByRole('link', { name: 'Server settings' }).click();
    await page.getByRole('button', { name: 'Show the QR code for ' + address }).click();
    await page
        .getByText('This code signs a phone in as admin. It works once, for 2 minutes.')
        .waitFor();
    await capture(page, 'server-addresses-pairing-qr');
    const [link] = await readQrCode(
        page.getByRole('img', { name: 'QR code for ' + address + '/leaf/' }),
    );

    return { address, link: link! };
}

it('opens Leaf signed in as the Admin from the address QR code', async () => {
    const { address, link } = await scannedLink();
    const phone = await browser.page(address, { viewport: viewports.phone });

    await phone.goto(link);

    await phone.getByRole('heading', { name: 'Your collections, wherever you shop.' }).waitFor();
    expect(link).toMatch(/\/leaf\/#pair=[A-Za-z0-9_-]{43}$/);
    expect(phone.url()).toBe(address + '/leaf/');
    await capture(phone, 'leaf-paired-home');
});

async function phoneAfterFirstUse(address: string, link: string): Promise<Page> {
    const first = await browser.page(address, { viewport: viewports.phone });

    await first.goto(link);
    await first.getByRole('heading', { name: 'Your collections, wherever you shop.' }).waitFor();

    return browser.page(address, { viewport: viewports.phone });
}

it('refuses the same QR code on a second phone', async () => {
    const { address, link } = await scannedLink();
    const second = await phoneAfterFirstUse(address, link);

    await second.goto(link);

    await second.getByText('This QR code has expired. Show it again on the computer.').waitFor();
    expect(await second.getByRole('heading', { name: 'Sign in' }).isVisible()).toBe(true);
});
