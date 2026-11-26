import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import type { Page } from 'playwright';
import type { BookDto, NewBookDto } from '../../packages/contracts/src/http.js';
import type { Client } from '../api/client.js';
import { BookInputFixture } from '../api/fixtures/book-input.fixture.js';
import { RuntimeFixture, RuntimeSetup } from '../api/runtime-setup.js';
import { BrowserFixture, capture, viewports } from './browser.js';

const browser = new BrowserFixture();
let runtime: RuntimeFixture;
let base: string;
let admin: Client;

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
    admin = started.client;
    await RuntimeSetup.administrator(started.client);
    await started.client.call('/users', 'POST', {
        username: 'morgan',
        password: 'guest-temporary',
        role: 'guest',
    });
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

it('refuses the mobile interface to a Guest', async () => {
    const page = await browser.page(base, { viewport: viewports.phone });

    await page.goto('/leaf/');
    await page.getByLabel(/^Username/).fill('morgan');
    await page.getByLabel(/^Password/).fill('guest-temporary');

    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.getByRole('heading', { name: 'Owner or Admin required' }).waitFor();
    await capture(page, 'leaf-guest-denied');
});

async function savedBook(overrides: Partial<NewBookDto>): Promise<BookDto> {
    const response = await admin.call<BookDto>('/books', 'POST', BookInputFixture.of(overrides));

    if (response.status !== 201) {
        throw new Error('Book fixture failed: ' + response.text);
    }

    return response.body;
}

async function signedIn(
    viewport: { width: number; height: number } = viewports.phone,
    locale = 'en-GB',
): Promise<Page> {
    const page = await browser.page(base, { viewport, locale });

    await page.goto('/leaf/');
    await page.getByLabel(/^(Username|Nom d’utilisateur)/).fill('admin');
    await page.getByLabel(/^(Password|Mot de passe)/).fill('administrator-new-password');
    await page.getByRole('button', { name: /^(Sign in|Se connecter)$/ }).click();
    await page
        .getByRole('heading', {
            name: /^(Your collections, wherever you shop\.|Vos collections, où que vous fassiez vos achats\.)$/,
        })
        .waitFor();

    return page;
}

interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

async function volumeBoxes(page: Page): Promise<Box[]> {
    return page.locator('.leaf-volume').evaluateAll((entries) =>
        entries.map((entry) => {
            const box = entry.getBoundingClientRect();

            return { x: box.x, y: box.y, width: box.width, height: box.height };
        }),
    );
}

async function scrollWidth(page: Page): Promise<number> {
    return page.evaluate(() => document.documentElement.scrollWidth);
}

async function batman(): Promise<BookDto> {
    await savedBook({
        title: 'Year One',
        isbn: null,
        noIsbn: true,
        category: 'comics',
        collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
    });

    return savedBook({
        title: 'The Killing Joke',
        isbn: null,
        noIsbn: true,
        category: 'comics',
        ownership: 'not-owned',
        collection: { collection: { name: 'Batman' }, volumeFrom: 3, volumeTo: 3 },
    });
}

it('shows an unfinished collection with its missing volumes for shopping', async () => {
    await batman();
    const page = await signedIn();

    await page.getByRole('link', { name: /Collections/ }).click();

    await page.getByRole('link', { name: /Batman/ }).click();

    await page.getByRole('heading', { name: 'Missing volumes' }).waitFor();
    expect(await page.getByText('Volume 2', { exact: true }).isVisible()).toBe(true);
    expect(await page.getByText('Volume 3', { exact: true }).isVisible()).toBe(true);
    expect(await page.getByRole('button', { name: 'Mark Volume 2 Owned' }).count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewports.phone.width,
    );
    await capture(page, 'leaf-collection-shopping');
});

async function batmanWithThreeMissing(): Promise<void> {
    await batman();
    await savedBook({
        title: 'Hush',
        isbn: null,
        noIsbn: true,
        category: 'comics',
        collection: { collection: { name: 'Batman' }, volumeFrom: 5, volumeTo: 5 },
    });
}

async function openBatman(page: Page): Promise<void> {
    await page.goto('/leaf/collections');
    await page.getByRole('link', { name: /Batman/ }).click();
    await page.locator('.leaf-volume').first().waitFor();
}

it('lists the missing volumes two per line, the odd last one half width', async () => {
    await batmanWithThreeMissing();
    const page = await signedIn();

    await openBatman(page);

    const [first, second, last] = await volumeBoxes(page);
    const button = await page.getByRole('button', { name: 'Mark Volume 3 Owned' }).boundingBox();

    expect(await page.locator('.leaf-volume').allTextContents()).toEqual([
        expect.stringContaining('Volume 4'),
        expect.stringContaining('Volume 3'),
        expect.stringContaining('Volume 2'),
    ]);
    expect(second?.y).toBe(first?.y);
    expect(second?.x).toBeGreaterThan((first?.x ?? 0) + (first?.width ?? 0));
    expect(second?.height).toBe(first?.height);
    expect(last?.y).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0));
    expect(last?.x).toBe(first?.x);
    expect(last?.width).toBe(first?.width);
    expect(button?.height).toBeGreaterThanOrEqual(44);
    expect(button?.y).toBeGreaterThan((second?.y ?? 0) + 20);
    expect(await scrollWidth(page)).toBeLessThanOrEqual(viewports.phone.width);
    await capture(page, 'leaf-collection-two-per-line');
});

it('keeps the French Mark Owned button inside its half-width entry', async () => {
    await batmanWithThreeMissing();
    const page = await signedIn(viewports.phone, 'fr-FR');

    await openBatman(page);

    const [first, second] = await volumeBoxes(page);
    const button = await page.locator('.leaf-volume .button').boundingBox();

    expect(second?.y).toBe(first?.y);
    expect(second?.height).toBe(first?.height);
    expect(button?.height).toBeGreaterThanOrEqual(44);
    expect((button?.x ?? 0) + (button?.width ?? 0)).toBeLessThanOrEqual(
        (second?.x ?? 0) + (second?.width ?? 0),
    );
    expect(await scrollWidth(page)).toBeLessThanOrEqual(viewports.phone.width);
});

it('lists the missing volumes one per line below 340 px', async () => {
    await batmanWithThreeMissing();
    const narrow = { width: 320, height: 700 };
    const page = await signedIn(narrow);

    await openBatman(page);

    const [first, second] = await volumeBoxes(page);

    expect(second?.x).toBe(first?.x);
    expect(second?.y).toBeGreaterThan(first?.y ?? 0);
    expect(await scrollWidth(page)).toBeLessThanOrEqual(narrow.width);
});

it('marks a saved Not Owned volume Owned after confirmation', async () => {
    const planned = await batman();
    const page = await signedIn();

    await page.getByRole('link', { name: /Collections/ }).click();
    await page.getByRole('link', { name: /Batman/ }).click();
    await page.getByRole('button', { name: 'Mark Volume 3 Owned' }).click();
    await page.getByRole('dialog', { name: 'Mark Volume 3 Owned?' }).waitFor();
    await capture(page, 'leaf-mark-owned');

    await page.getByRole('button', { name: 'Confirm Owned' }).click();

    await page.getByText('Volume 3 is now Owned.').waitFor();
    await page.getByText('Volume 3', { exact: true }).waitFor({ state: 'detached' });
    const book = await admin.call<BookDto>('/books/' + planned.id);

    expect(book.body.ownership).toBe('owned');
});

it('refuses a Guest who opens a shopping link directly', async () => {
    const page = await browser.page(base, { viewport: viewports.phone });

    await page.goto('/leaf/collections');
    await page.getByLabel(/^Username/).fill('morgan');
    await page.getByLabel(/^Password/).fill('guest-temporary');

    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.getByRole('heading', { name: 'Owner or Admin required' }).waitFor();
    expect(await page.getByRole('heading', { name: 'Your collections' }).count()).toBe(0);
});
