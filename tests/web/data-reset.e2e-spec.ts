import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import type { Client } from '../api/client.js';
import { RuntimeFixture, RuntimeSetup } from '../api/runtime-setup.js';
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
    await RuntimeSetup.administrator(api);
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
    await api.call('/tags', 'POST', { name: 'Signed copies' });
    await api.call('/appearance', 'PUT', { colorScheme: 'mint' });
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

async function openDataReset(page: Page) {
    await signIn(page, 'admin', 'administrator-new-password');
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    await page.getByRole('link', { name: 'Accounts' }).click();
    await page.getByRole('button', { name: 'Reset application data' }).click();

    return page.getByRole('dialog', { name: 'Reset application data' });
}

async function confirmReset(page: Page, password: string) {
    const dialog = await openDataReset(page);

    await dialog.getByLabel(/^Current Admin password/).fill(password);
    await dialog.getByRole('checkbox', { name: 'I understand this cannot be undone' }).check();

    return dialog;
}

describe('Admin data reset', () => {
    it('signs the Admin out to the sign-in page', async () => {
        const page = await browser.page(base, { viewport: viewports.referenceDesktop });
        const dialog = await confirmReset(page, 'administrator-new-password');

        await capture(page, 'data-reset-dialog');

        await dialog.getByRole('button', { name: 'Reset data and sign out' }).click();

        await page.getByRole('heading', { name: 'Sign in' }).waitFor();
        expect(await page.getByRole('heading', { name: 'Sign in' }).isVisible()).toBe(true);
    });
    it('returns the colour scheme to Spring green', async () => {
        const page = await browser.page(base, { viewport: viewports.referenceDesktop });
        const dialog = await confirmReset(page, 'administrator-new-password');

        await dialog.getByRole('button', { name: 'Reset data and sign out' }).click();

        await page.getByRole('heading', { name: 'Sign in' }).waitFor();
        await page.waitForFunction(
            () => document.documentElement.dataset.colorScheme === 'spring-green',
        );
        expect(await page.evaluate(() => document.documentElement.dataset.colorScheme)).toBe(
            'spring-green',
        );
    });
    it('keeps the Admin credentials and starts with an empty Activity', async () => {
        const page = await browser.page(base, { viewport: viewports.referenceDesktop });
        const dialog = await confirmReset(page, 'administrator-new-password');

        await dialog.getByRole('button', { name: 'Reset data and sign out' }).click();
        await page.getByRole('heading', { name: 'Sign in' }).waitFor();

        await signIn(page, 'admin', 'administrator-new-password');

        await page.getByRole('heading', { name: 'Overview' }).waitFor();
        await page.getByRole('link', { name: 'Activity' }).click();
        await page.getByText('No shared activity yet.').waitFor();
        expect(await page.getByText('No shared activity yet.').isVisible()).toBe(true);
    });
    it('erases the other accounts', async () => {
        const page = await browser.page(base, { viewport: viewports.referenceDesktop });
        const dialog = await confirmReset(page, 'administrator-new-password');

        await dialog.getByRole('button', { name: 'Reset data and sign out' }).click();
        await page.getByRole('heading', { name: 'Sign in' }).waitFor();

        await signIn(page, 'camille', 'temporary-1');

        await page.getByText('Incorrect username or password.').waitFor();
        expect(await page.getByRole('heading', { name: 'Sign in' }).isVisible()).toBe(true);
    });
    it('keeps the data when the password is wrong', async () => {
        const page = await browser.page(base, { viewport: viewports.referenceDesktop });
        const dialog = await confirmReset(page, 'wrong-password');

        await dialog.getByRole('button', { name: 'Reset data and sign out' }).click();

        await dialog.getByText('Your current password is incorrect.').waitFor();
        const tags = await api.call<{ name: string }[]>('/tags');

        expect(tags.body.map((tag) => tag.name)).toEqual(['Signed copies']);
    });
    it('offers no data reset to an Owner', async () => {
        const page = await browser.page(base, { viewport: viewports.referenceDesktop });

        await signIn(page, 'camille', 'temporary-1');
        await page.getByLabel(/^Current password/).fill('temporary-1');
        await page.getByLabel(/^New password/).fill('owner-password');
        await page.getByLabel(/^Confirm new password/).fill('owner-password');
        await page.getByRole('button', { name: 'Save password and continue' }).click();
        await page.getByRole('heading', { name: 'Overview' }).waitFor();

        await page.goto('/admin/accounts');

        await page.getByText('This page is unavailable').waitFor();
        expect(await page.getByRole('button', { name: 'Reset application data' }).count()).toBe(0);
    });
    it('offers no data reset to a Guest', async () => {
        const page = await browser.page(base, { viewport: viewports.referenceDesktop });

        await signIn(page, 'morgan', 'temporary-2');
        await page.getByLabel(/^Current password/).fill('temporary-2');
        await page.getByLabel(/^New password/).fill('guest-password');
        await page.getByLabel(/^Confirm new password/).fill('guest-password');
        await page.getByRole('button', { name: 'Save password and continue' }).click();
        await page.getByRole('heading', { name: 'Overview' }).waitFor();

        await page.goto('/admin/accounts');

        await page.getByText('This page is unavailable').waitFor();
        expect(await page.getByRole('button', { name: 'Reset application data' }).count()).toBe(0);
    });
});
