import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import { RuntimeFixture } from '../api/runtime-setup.js';
import { BrowserFixture, capture, viewports } from './browser.js';

const browser = new BrowserFixture();
let runtime: RuntimeFixture;
let base: string;

beforeAll(async () => {
    await browser.launch();
});
afterAll(async () => {
    await browser.close();
});
beforeEach(async () => {
    runtime = new RuntimeFixture();
    base = (await runtime.start()).client.base;
});
afterEach(async () => {
    await browser.closeContexts();
    await runtime.teardown();
});

async function signIn(page: Page, username: string, password: string) {
    await page.getByLabel(/^Username/).fill(username);
    await page.getByLabel(/^Password/).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
}

// First startup: the foundation administrator replaces its temporary password.
async function completeAdministratorSetup(page: Page) {
    await page.goto('/');
    await signIn(page, 'admin', 'p@ssw0rd');
    await page.getByLabel(/^Current password/).fill('p@ssw0rd');
    await page.getByLabel(/^New password/).fill('administrator-password');
    await page.getByLabel(/^Confirm new password/).fill('administrator-password');
    await page.getByRole('button', { name: 'Save password and continue' }).click();
    await page.getByRole('heading', { name: 'My account' }).waitFor();
}

describe('Libris', () => {
    it('shows the product name and sign-in form', async () => {
        const page = await browser.page(base);

        await page.goto('/');

        await page.getByRole('heading', { name: 'Sign in' }).waitFor();
        expect(await page.title()).toBe('Libris');
        expect(await page.getByText('by Media Collection').isVisible()).toBe(true);
        await capture(page, 'libris-sign-in');
    });

    it('follows a French browser language before sign-in', async () => {
        const page = await browser.page(base, { locale: 'fr-FR' });

        await page.goto('/');

        await page.getByRole('heading', { name: 'Connexion' }).waitFor();
        expect(await page.locator('html').getAttribute('lang')).toBe('fr');
        await capture(page, 'libris-sign-in-fr');
    });

    it('requires replacing the temporary password before entering the library', async () => {
        const page = await browser.page(base);

        await page.goto('/');
        await signIn(page, 'admin', 'p@ssw0rd');

        await page.getByRole('heading', { name: 'Choose your own password' }).waitFor();
        expect(await page.getByRole('navigation').count()).toBe(0);
        await capture(page, 'libris-password-setup');
    });

    it('opens the library shell at the minimum desktop size without horizontal scrolling', async () => {
        const page = await browser.page(base, { viewport: viewports.minimumDesktop });

        await completeAdministratorSetup(page);

        const width = await page.evaluate(() => document.documentElement.scrollWidth);
        const serverSettings = await page
            .getByRole('link', { name: 'Server settings' })
            .isVisible();

        expect(width).toBeLessThanOrEqual(viewports.minimumDesktop.width);
        expect(serverSettings).toBe(true);
        await capture(page, 'libris-account-1280');
    });

    it('saves the language on the account and applies it on another device', async () => {
        const first = await browser.page(base);

        await completeAdministratorSetup(first);
        await first.getByRole('button', { name: 'Français' }).first().click();
        await first.getByRole('heading', { name: 'Mon compte' }).waitFor();
        const second = await browser.page(base, { locale: 'en-GB' });

        await second.goto('/');
        await signIn(second, 'admin', 'administrator-password');

        await second.getByRole('heading', { name: 'Mon compte' }).waitFor();
        expect(await second.locator('html').getAttribute('lang')).toBe('fr');
    });

    it('opens an administration page from a direct link', async () => {
        const page = await browser.page(base, { viewport: viewports.referenceDesktop });

        await completeAdministratorSetup(page);

        await page.goto('/admin/server');

        await page.getByRole('heading', { name: 'Server settings' }).waitFor();
        await page.getByRole('heading', { name: 'HTTP / web interface' }).waitFor();
        expect(new URL(page.url()).pathname).toBe('/admin/server');
        await capture(page, 'libris-server-settings-1440');
    });
});
