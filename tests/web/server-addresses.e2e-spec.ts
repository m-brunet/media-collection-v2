import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { RuntimeFixture, RuntimeSetup } from '../api/runtime-setup.js';
import { BrowserFixture, capture, viewports } from './browser.js';
import { readQrCode } from './qr-reader.js';

const browser = new BrowserFixture();
const runtime = new RuntimeFixture();
const homeAddress = 'http://192.168.1.99:34345';

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

it('shows a QR code that a phone reads as Leaf at the chosen address', async () => {
    const started = await runtime.start();

    await RuntimeSetup.administrator(started.client);
    const page = await browser.page(started.client.base, { viewport: viewports.referenceDesktop });

    await page.route('**/api/server-settings', async (route) => {
        const response = await route.fetch();
        const body = await response.json();

        body.running.addresses = ['http://127.0.0.1:34345', homeAddress];
        await route.fulfill({ response, json: body });
    });
    await page.goto('/');
    await page.getByLabel(/^Username/).fill('admin');
    await page.getByLabel(/^Password/).fill('administrator-new-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    await page.getByRole('link', { name: 'Server settings' }).click();

    await page.getByRole('button', { name: 'Show the QR code for ' + homeAddress }).click();
    const code = page.getByRole('img', { name: 'QR code for ' + homeAddress + '/leaf/' });

    await code.waitFor();
    await capture(page, 'server-addresses-qr');

    expect(await readQrCode(code)).toEqual([homeAddress + '/leaf/']);
});
