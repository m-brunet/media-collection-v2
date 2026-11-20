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

function view(page: Page, name: string) {
    return page.getByRole('radiogroup', { name: 'View' }).getByRole('radio', { name }).click();
}

describe('Statistics', () => {
    it('counts the owned books and narrows every number to the chosen category', async () => {
        await book('Dune', { pageCount: 600 });
        await book('Akira', { category: 'manga', pageCount: 360 });
        await book('Emma', { ownership: 'not-owned' });
        const page = await statistics('camille');

        await page.getByRole('heading', { name: 'Owned books' }).waitFor();
        const all = [await owned(page), await page.getByText('960', { exact: true }).count()];

        await page
            .getByRole('group', { name: 'Show' })
            .locator('label', { hasText: 'Manga' })
            .click();
        await page.waitForURL(/category=manga/);
        await page.getByText('360', { exact: true }).waitFor();

        expect([all, await owned(page), new URL(page.url()).search]).toEqual([
            ['2', 1],
            '1',
            '?category=manga',
        ]);
    });

    it('splits the categories by pages once chosen', async () => {
        await book('Dune', { pageCount: 600 });
        await book('Akira', { category: 'manga', pageCount: 400 });
        const page = await statistics('camille');
        const legend = page.getByRole('list', { name: 'By category' });

        await legend.waitFor();
        await page
            .getByRole('group', { name: 'Count the categories by' })
            .getByText('By pages')
            .click();

        await legend.getByText('600 · 60%').waitFor();
        expect(await legend.getByRole('listitem').allTextContents()).toEqual([
            'Books600 · 60%',
            'Manga400 · 40%',
            'Comics0 · 0%',
        ]);
    });

    it('fits the smallest desktop window', async () => {
        await book('Dune', { publisher: 'A publisher with a rather long name for a ranking' });
        const page = await statistics('camille');

        await page.getByRole('heading', { name: 'Top publishers' }).waitFor();

        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
            viewports.minimumDesktop.width,
        );
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

    it('keeps the chosen category while switching to the Story and Topics views', async () => {
        await book('Dune');
        await book('Akira', { category: 'manga' });
        const page = await statistics('camille');

        await page.getByRole('heading', { name: 'Owned books' }).waitFor();
        await page
            .getByRole('group', { name: 'Show' })
            .locator('label', { hasText: 'Manga' })
            .click();
        await page.waitForURL(/category=manga/);
        await view(page, 'Story');
        await page.getByText('You own 1 manga.').waitFor();
        await view(page, 'Topics');
        await page.getByRole('group', { name: 'Topics' }).waitFor();

        expect(new URL(page.url()).searchParams.get('category')).toBe('manga');
    });

    it('fits the smallest desktop window in the Story and Topics views', async () => {
        await book('Dune', { publisher: 'A publisher with a rather long name for a ranking' });
        const page = await statistics('camille');
        const widths: number[] = [];

        for (const name of ['Story', 'Topics']) {
            await view(page, name);
            await page.waitForURL(new RegExp('view=' + name.toLowerCase()));
            widths.push(await page.evaluate(() => document.documentElement.scrollWidth));
        }

        expect(Math.max(...widths)).toBeLessThanOrEqual(viewports.minimumDesktop.width);
    });
});
