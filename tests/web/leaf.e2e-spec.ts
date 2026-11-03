import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
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

it('serves Leaf at /leaf/ on the same port as Libris', async () => {
    const page = await browser.page(base, { viewport: viewports.phone });

    await page.goto('/leaf/');

    await page.getByRole('heading', { name: 'Sign in' }).waitFor();
    expect(await page.title()).toBe('Leaf');
    await capture(page, 'leaf-sign-in');
});

it('serves Leaf for a deep link inside /leaf', async () => {
    const page = await browser.page(base, { viewport: viewports.phone });

    await page.goto('/leaf/collections/batman');

    await page.getByRole('heading', { name: 'Sign in' }).waitFor();
    expect(await page.title()).toBe('Leaf');
});

it('signs in on a phone and shows the mobile home without horizontal scrolling', async () => {
    const page = await browser.page(base, { viewport: viewports.phone });

    await page.goto('/leaf/');
    await page.getByLabel(/^Username/).fill('admin');
    await page.getByLabel(/^Password/).fill('administrator-new-password');

    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.getByRole('heading', { name: 'Your collections, wherever you shop.' }).waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewports.phone.width,
    );
    await capture(page, 'leaf-home');
});
