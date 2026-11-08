import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import { Client } from '../api/client.js';
import type { RuntimeOptions } from '../api/runtime.js';
import { RuntimeFixture, RuntimeSetup } from '../api/runtime-setup.js';
import { BrowserFixture, capture, viewports } from './browser.js';

const browser = new BrowserFixture();
const publicAddress = '82.66.118.204';
let runtime: RuntimeFixture;

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

// Starts the application with stand-ins for the router and Let's Encrypt, an Admin, and a free
// HTTPS port, then opens Server settings.
async function serverSettings(internetAccess: NonNullable<RuntimeOptions['internetAccess']>) {
    runtime = new RuntimeFixture();
    const started = await runtime.start(undefined, { internetAccess });
    const httpsPort = await RuntimeSetup.availablePort();

    await RuntimeSetup.administrator(started.client);
    await started.client.call('/server-settings', 'PUT', { enabled: false, port: httpsPort });
    const page = await browser.page(started.client.base, {
        viewport: viewports.referenceDesktop,
    });

    await signIn(page);
    await page.getByRole('link', { name: 'Server settings' }).click();
    await page.getByRole('heading', { name: 'Internet access' }).waitFor();

    return { page, httpsPort };
}

async function signIn(page: Page) {
    await page.goto('/');
    await page.getByLabel(/^Username/).fill('admin');
    await page.getByLabel(/^Password/).fill('administrator-new-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
}

describe('Internet access', () => {
    it('sets up internet access and gives the Leaf address with its QR code', async () => {
        const { page } = await serverSettings({ externalAddress: publicAddress, accepts: true });

        await page.getByRole('button', { name: 'Set up internet access' }).click();
        await page.getByText('Internet access is on.').waitFor();
        await capture(page, 'internet-access-active');

        expect(
            await page
                .getByRole('link', { name: 'https://' + publicAddress + '/leaf/' })
                .isVisible(),
        ).toBe(true);
        expect(
            await page
                .getByRole('img', { name: 'QR code for https://' + publicAddress + '/leaf/' })
                .isVisible(),
        ).toBe(true);
    });
    it('starts HTTPS with the new certificate without a restart', async () => {
        const { page, httpsPort } = await serverSettings({
            externalAddress: publicAddress,
            accepts: true,
        });

        await page.getByRole('button', { name: 'Set up internet access' }).click();
        await page.getByText('Internet access is on.').waitFor();

        const response = await new Client('https://127.0.0.1:' + httpsPort).call('/health');

        expect(response.status).toBe(200);
        expect(await page.getByText('Close and reopen the desktop application').count()).toBe(0);
    });
    it('gives the router rule to add by hand when the router refuses', async () => {
        const { page, httpsPort } = await serverSettings({
            externalAddress: publicAddress,
            accepts: false,
        });

        await page.getByRole('button', { name: 'Set up internet access' }).click();
        await page.getByRole('heading', { name: 'Add the rule in your router' }).waitFor();
        await capture(page, 'internet-access-manual-rule');

        expect(await page.getByText(/refused to open port 443/).isVisible()).toBe(true);
        expect(await page.getByText(String(httpsPort), { exact: true }).isVisible()).toBe(true);
        expect(await page.getByRole('button', { name: 'Check again' }).isVisible()).toBe(true);
    });
    it('explains a provider that shares the public address', async () => {
        const { page } = await serverSettings({ externalAddress: '100.70.0.1', accepts: true });

        await page.getByRole('button', { name: 'Set up internet access' }).click();
        await page.getByText(/shares your public address/).waitFor();

        expect(await page.getByRole('button', { name: 'Set up internet access' }).isVisible()).toBe(
            true,
        );
    });
});
