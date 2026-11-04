import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import type { Page } from 'playwright';
import { administrator, RuntimeFixture } from '../api/runtime-setup.js';
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
    const started = await runtime.start();

    base = started.client.base;
    await administrator(started.client);
});
afterEach(async () => {
    await browser.closeContexts();
    await runtime.teardown();
});

function primaryButtonColor(page: Page): Promise<string> {
    return page
        .getByRole('button', { name: 'Sign in' })
        .evaluate((element) => getComputedStyle(element).backgroundColor);
}

it('shows Spring green by default, before anyone signs in', async () => {
    const page = await browser.page(base);

    await page.goto('/');
    await page.getByRole('heading', { name: 'Sign in' }).waitFor();

    const color = await primaryButtonColor(page);

    expect(color).toBe('rgb(121, 214, 112)');
});

it('applies the scheme chosen by the administrator to every visitor', async () => {
    const admin = await browser.page(base, { viewport: viewports.referenceDesktop });

    await admin.goto('/');
    await admin.getByLabel(/^Username/).fill('admin');
    await admin.getByLabel(/^Password/).fill('administrator-new-password');
    await admin.getByRole('button', { name: 'Sign in' }).click();
    await admin.getByRole('link', { name: 'Appearance' }).click();
    await admin.getByRole('radio', { name: /Mint/ }).check();
    await admin.getByText('Colour scheme saved.').waitFor();
    await capture(admin, 'appearance-page');
    const visitor = await browser.page(base);

    await visitor.goto('/');
    await visitor.getByRole('heading', { name: 'Sign in' }).waitFor();
    await visitor.waitForFunction(() => document.documentElement.dataset.colorScheme === 'mint');

    expect(await primaryButtonColor(visitor)).toBe('rgb(134, 211, 154)');
    await capture(visitor, 'appearance-sign-in-mint');
});
