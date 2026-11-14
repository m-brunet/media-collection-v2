import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import type { BookDto, NewBookDto } from '../../packages/contracts/src/http.js';
import { RuntimeFixture, RuntimeSetup } from '../api/runtime-setup.js';
import { Client } from '../api/client.js';
import { BookInputFixture } from '../api/fixtures/book-input.fixture.js';
import { BrowserFixture, viewports } from './browser.js';

const browser = new BrowserFixture();
let runtime: RuntimeFixture;
let base: string;
let admin: Client;
let camille: Client;

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
    await RuntimeSetup.administrator(admin);
    camille = await account('camille', 'owner');
    await account('morgan', 'guest');
});
afterEach(async () => {
    await browser.closeContexts();
    await runtime.teardown();
});

async function account(username: string, role: 'owner' | 'guest'): Promise<Client> {
    await admin.call('/users', 'POST', { username, password: 'temporary-pw', role });
    const client = new Client(base);

    await client.login(username, 'temporary-pw');
    await client.call('/account/password', 'PATCH', {
        currentPassword: 'temporary-pw',
        password: username + '-password',
    });

    return client;
}

async function book(title: string, overrides: Partial<NewBookDto> = {}): Promise<BookDto> {
    const response = await camille.call<BookDto>(
        '/books',
        'POST',
        BookInputFixture.of({
            title,
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            ...overrides,
        }),
    );

    if (response.status >= 300) {
        throw new Error('Fixture failed: ' + response.text);
    }

    return response.body;
}

async function statistics(username: string): Promise<Page> {
    const page = await browser.page(base, { viewport: viewports.minimumDesktop });

    await page.goto('/');
    await page.getByLabel(/^Username/).fill(username);
    await page.getByLabel(/^Password/).fill(username + '-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    await page.getByRole('link', { name: 'Statistics' }).click();
    await page.getByRole('heading', { name: 'Statistics', level: 1 }).waitFor();

    return page;
}

function owned(page: Page) {
    return page
        .locator('section', { has: page.getByRole('heading', { name: 'Owned books' }) })
        .locator('.statistics-card__value')
        .textContent();
}

describe('Statistics', () => {
    it('counts the owned books and narrows every number to the chosen category', async () => {
        await book('Dune', { pageCount: 600 });
        await book('Akira', { category: 'manga', pageCount: 360 });
        await book('Emma', { ownership: 'not-owned' });
        const page = await statistics('camille');

        await page.getByRole('heading', { name: 'Owned books' }).waitFor();
        const all = [await owned(page), await page.getByText('960', { exact: true }).count()];

        await page.getByRole('radio', { name: 'Manga' }).check({ force: true });
        await page.getByText('360', { exact: true }).waitFor();

        expect([
            all,
            await owned(page),
            new URL(page.url()).search,
            await page.getByRole('heading', { name: 'Your reading' }).count(),
            await page.evaluate(() => document.documentElement.scrollWidth),
        ]).toEqual([['2', 1], '1', '?category=manga', 1, viewports.minimumDesktop.width]);
    });

    it('shows a Guest the numbers without any reading', async () => {
        await book('Dune');
        const page = await statistics('morgan');

        await page.getByRole('heading', { name: 'Owned books' }).waitFor();

        expect([
            await page.getByRole('heading', { name: 'Read by you' }).count(),
            await page.getByRole('heading', { name: 'Your reading' }).count(),
        ]).toEqual([0, 0]);
    });
});
