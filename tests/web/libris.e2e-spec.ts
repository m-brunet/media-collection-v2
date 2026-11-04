import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import { administrator, RuntimeFixture } from '../api/runtime-setup.js';
import type { Client } from '../api/client.js';
import { BrowserFixture, capture, viewports } from './browser.js';

const browser = new BrowserFixture();
let runtime: RuntimeFixture;
let base: string;
let api: Client;

beforeAll(async () => {
    await browser.launch();
});
afterAll(async () => {
    await browser.close();
});
beforeEach(async () => {
    runtime = new RuntimeFixture();
    const started = await runtime.start();

    base = started.client.base;
    api = started.client;
});
afterEach(async () => {
    await browser.closeContexts();
    await runtime.teardown();
});

async function signIn(page: Page, username: string, password: string) {
    await page.goto('/');
    await page.getByLabel(/^Username/).fill(username);
    await page.getByLabel(/^Password/).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
}

// An installation whose administrator exists, with one Owner and one Guest account.
async function household() {
    await administrator(api);
    await api.call('/users', 'POST', {
        username: 'camille',
        password: 'temporary-1',
        role: 'owner',
    });
    await api.call('/users', 'POST', {
        username: 'morgan',
        password: 'temporary-2',
        role: 'guest',
    });
}

async function replaceTemporaryPassword(page: Page, current: string, next: string) {
    await page.getByLabel(/^Current password/).fill(current);
    await page.getByLabel(/^New password/).fill(next);
    await page.getByLabel(/^Confirm new password/).fill(next);
    await page.getByRole('button', { name: 'Save password and continue' }).click();
    await page.getByRole('heading', { name: 'My books' }).waitFor();
}

describe('Libris first launch', () => {
    it('asks for the protected administrator before anything else', async () => {
        const page = await browser.page(base, { desktopWindow: true });

        await page.goto('/');

        await page.getByRole('heading', { name: 'Set up your library' }).waitFor();
        expect(await page.title()).toBe('Libris');
        expect(await page.getByText('by Media Collection').isVisible()).toBe(true);
        await capture(page, 'libris-setup');
    });

    it('creates the administrator and opens the library at the minimum desktop size', async () => {
        const page = await browser.page(base, {
            viewport: viewports.minimumDesktop,
            desktopWindow: true,
        });

        await page.goto('/');
        await page.getByLabel(/^Administrator username/).fill('alex');
        await page.getByLabel(/^Administrator password/).fill('chosen-password');
        await page.getByLabel(/^Confirm password/).fill('chosen-password');

        await page.getByRole('button', { name: 'Create administrator' }).click();

        await page.getByRole('heading', { name: 'My books' }).waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
            viewports.minimumDesktop.width,
        );
        expect(await page.getByRole('link', { name: 'Accounts' }).isVisible()).toBe(true);
        await capture(page, 'libris-books-admin-1280');
    });

    it('keeps setup out of reach of a browser, even on the same computer', async () => {
        const page = await browser.page(base);

        await page.goto('/');

        await page.getByRole('heading', { name: 'Setup is not finished yet' }).waitFor();
        expect(await page.getByRole('button', { name: 'Create administrator' }).count()).toBe(0);
        await capture(page, 'libris-setup-browser');
    });

    it('follows a French browser language', async () => {
        const page = await browser.page(base, { locale: 'fr-FR', desktopWindow: true });

        await page.goto('/');

        await page.getByRole('heading', { name: 'Configurez votre bibliothèque' }).waitFor();
        expect(await page.locator('html').getAttribute('lang')).toBe('fr');
    });
});

describe('Libris accounts', () => {
    beforeEach(async () => {
        await household();
    });

    it('shows the sign-in page once the library is set up', async () => {
        const page = await browser.page(base);

        await page.goto('/');

        await page.getByRole('heading', { name: 'Sign in' }).waitFor();
        await capture(page, 'libris-sign-in');
    });

    it('lets the administrator create an Owner account', async () => {
        const page = await browser.page(base, { viewport: viewports.referenceDesktop });

        await signIn(page, 'admin', 'administrator-new-password');
        await page.getByRole('link', { name: 'Accounts' }).click();
        await page.getByRole('button', { name: 'Create account' }).click();
        const dialog = page.getByRole('dialog', { name: 'Create account' });

        await dialog.getByLabel(/^Username/).fill('sam');
        await dialog.getByLabel(/^Role/).selectOption('owner');
        await dialog.getByLabel(/^Temporary password/).fill('temporary-3');
        await capture(page, 'libris-create-account');
        await dialog.getByRole('button', { name: 'Create account' }).click();

        await page
            .getByText('Account created. Share the temporary password with its owner.')
            .waitFor();
        expect(await page.getByRole('cell', { name: 'sam', exact: true }).isVisible()).toBe(true);
        await capture(page, 'libris-user-management');
    });

    it('requires the exact letter case of the username at sign-in', async () => {
        const page = await browser.page(base);

        await signIn(page, 'ADMIN', 'administrator-new-password');

        await page.getByText('Incorrect username or password.').waitFor();
        expect(await page.getByRole('heading', { name: 'Sign in' }).isVisible()).toBe(true);
    });

    it('makes a new account replace its temporary password first', async () => {
        const page = await browser.page(base);

        await signIn(page, 'camille', 'temporary-1');

        await page.getByRole('heading', { name: 'Choose your own password' }).waitFor();
        expect(await page.getByRole('navigation').count()).toBe(0);
    });

    it('gives a Guest no administration and explains a refused page', async () => {
        const page = await browser.page(base);

        await signIn(page, 'morgan', 'temporary-2');
        await replaceTemporaryPassword(page, 'temporary-2', 'guest-password');

        await page.goto('/admin/accounts');

        await page.getByText('This page is unavailable').waitFor();
        expect(await page.getByRole('link', { name: 'Accounts' }).count()).toBe(0);
        await capture(page, 'libris-permission-denied');
    });

    it('signs a deactivated account out and keeps it out', async () => {
        const owner = await browser.page(base);
        const admin = await browser.page(base);

        await signIn(owner, 'camille', 'temporary-1');
        await owner.getByRole('heading', { name: 'Choose your own password' }).waitFor();
        await signIn(admin, 'admin', 'administrator-new-password');
        await admin.getByRole('link', { name: 'Accounts' }).click();
        await admin.getByRole('button', { name: 'Deactivate · camille' }).click();

        await admin.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click();

        await admin.getByText('Account camille deactivated.').waitFor();
        await signIn(owner, 'camille', 'temporary-1');
        await owner.getByText('Incorrect username or password.').waitFor();
    });

    it('saves the language on the account and applies it on another device', async () => {
        const first = await browser.page(base);

        await signIn(first, 'admin', 'administrator-new-password');
        await first.getByRole('heading', { name: 'My books' }).waitFor();
        await first.getByRole('button', { name: 'Français' }).first().click();
        await first.getByRole('heading', { name: 'Mes livres' }).waitFor();
        const second = await browser.page(base, { locale: 'en-GB' });

        await signIn(second, 'admin', 'administrator-new-password');

        await second.getByRole('heading', { name: 'Mes livres' }).waitFor();
        expect(await second.locator('html').getAttribute('lang')).toBe('fr');
    });

    it('opens an administration page from a direct link', async () => {
        const page = await browser.page(base, { viewport: viewports.referenceDesktop });

        await signIn(page, 'admin', 'administrator-new-password');
        await page.getByRole('heading', { name: 'My books' }).waitFor();

        await page.goto('/admin/server');

        await page.getByRole('heading', { name: 'HTTP / web interface' }).waitFor();
        expect(new URL(page.url()).pathname).toBe('/admin/server');
    });
});
