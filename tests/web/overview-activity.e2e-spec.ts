import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import type { BookDto, NewBookDto } from '../../packages/contracts/src/http.js';
import { RuntimeFixture, RuntimeSetup } from '../api/runtime-setup.js';
import { Client } from '../api/client.js';
import { BookInputFixture } from '../api/fixtures/book-input.fixture.js';
import { BrowserFixture, capture, viewports } from './browser.js';

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

async function sent<T>(client: Client, path: string, method: string, body: object): Promise<T> {
    const response = await client.call<T>(path, method, body);

    if (response.status >= 300) {
        throw new Error('Fixture failed on ' + path + ': ' + response.text);
    }

    return response.body;
}

async function book(title: string, overrides: Partial<NewBookDto> = {}): Promise<BookDto> {
    return sent<BookDto>(
        camille,
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
}

async function signedIn(username: string, password = username + '-password'): Promise<Page> {
    const page = await browser.page(base, { viewport: viewports.minimumDesktop });

    await page.goto('/');
    await page.getByLabel(/^Username/).fill(username);
    await page.getByLabel(/^Password/).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Overview' }).waitFor();

    return page;
}

async function openActivity(page: Page) {
    await page.getByRole('link', { name: 'Activity' }).click();
    await page.getByRole('heading', { name: 'Activity' }).waitFor();
}

function actions(page: Page) {
    return page.locator('.activity-entry__action').allTextContents();
}

function pageWidth(page: Page) {
    return page.evaluate(() => document.documentElement.scrollWidth);
}

describe('Overview', () => {
    it('counts the library and lists the newest Owned books for an Owner', async () => {
        await book('Dune');
        await book('Emma', { ownership: 'not-owned' });
        const piranesi = await book('Piranesi');
        const oak = await sent<{ id: string }>(camille, '/bookcases', 'POST', { name: 'Oak' });

        await sent(camille, '/bookcases/' + oak.id + '/shelves', 'POST', { name: 'Top' });
        await sent(camille, '/loans', 'POST', {
            receiver: { name: 'Sam' },
            bookIds: [piranesi.id],
        });

        const page = await signedIn('camille');

        const counters = page.locator('.overview-counter');

        await page.getByText('Owned books', { exact: true }).waitFor();
        expect(await counters.allTextContents()).toEqual([
            'Owned books2',
            'Collections0',
            'Bookcases / shelves1 / 1',
            'Currently lent1',
        ]);
        const recent = page.getByRole('list', { name: 'Recently added' });

        expect(await recent.getByRole('link').allTextContents()).toEqual([
            expect.stringContaining('Piranesi'),
            expect.stringContaining('Dune'),
        ]);
        expect(await page.getByText('0 Read / 2 Not read').count()).toBe(1);
        expect(await page.getByText('Oak · 1 shelf').count()).toBe(1);
        expect(await pageWidth(page)).toBeLessThanOrEqual(viewports.minimumDesktop.width);
        await capture(page, 'overview-owner-1280');
    });

    it('updates the reading summary after the Owner marks a book Read', async () => {
        const dune = await book('Dune');

        await book('Emma');
        const page = await signedIn('camille');

        await page.getByText('0 Read / 2 Not read').waitFor();
        await sent(camille, '/books/' + dune.id + '/reading', 'PUT', { read: true });

        await page.reload();

        await page.getByText('1 Read / 1 Not read').waitFor();
        const recent = page.getByRole('list', { name: 'Recently added' });

        expect(await recent.getByText('Owned · Read', { exact: true }).count()).toBe(1);
    });

    it('opens a recently added book', async () => {
        await book('Dune');
        const page = await signedIn('camille');

        await page.getByRole('list', { name: 'Recently added' }).getByRole('link').click();

        await page.getByRole('heading', { name: 'Dune' }).waitFor();
    });

    it('shows a Guest the counters without any reading', async () => {
        await book('Dune');

        const page = await signedIn('morgan');

        await page.getByRole('list', { name: 'Recently added' }).waitFor();
        expect(await page.getByText('Your reading · Owned books').count()).toBe(0);
        expect(await page.getByText(/Not read/).count()).toBe(0);
        expect(await page.getByRole('button', { name: 'Add a book' }).count()).toBe(0);
        await capture(page, 'overview-guest-1280');
    });
});

describe('Activity', () => {
    it('shows a lending of two books as one household entry', async () => {
        const dune = await book('Dune');
        const emma = await book('Emma');

        await sent(camille, '/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: [dune.id, emma.id],
        });
        const page = await signedIn('admin', 'administrator-new-password');

        await openActivity(page);

        expect(await actions(page)).toEqual([
            'You lent 2 books to Sam Taylor',
            'You added Emma',
            'You added Dune',
        ]);
        expect(await page.getByText('Also: added the receiver Sam Taylor').count()).toBe(1);
        expect(await pageWidth(page)).toBeLessThanOrEqual(viewports.minimumDesktop.width);
        await capture(page, 'activity-1280');
    });

    it('shows the exact time and the acting account on keyboard focus', async () => {
        await sent(camille, '/tags', 'POST', { name: 'Fantasy' });
        const page = await signedIn('admin', 'administrator-new-password');

        await openActivity(page);

        await page.locator('.activity-time__relative').first().focus();

        const details = page.getByRole('tooltip');

        await details.waitFor();
        expect(await details.locator('.activity-time__moment').textContent()).toMatch(
            / · \d{2}:\d{2} \(.+\)$/,
        );
        expect(await details.locator('.activity-time__actor').textContent()).toBe(
            'Performed by camille',
        );
    });

    it('names a renamed account by its new username in the details of older entries', async () => {
        await sent(camille, '/tags', 'POST', { name: 'Fantasy' });
        await sent(camille, '/account/username', 'PATCH', {
            username: 'camille-r',
            currentPassword: 'camille-password',
        });
        const page = await signedIn('morgan');

        await openActivity(page);

        await page.locator('.activity-time__relative').first().hover();

        expect(await page.getByRole('tooltip').locator('.activity-time__actor').textContent()).toBe(
            'Performed by camille-r',
        );
    });

    it('leaves out personal reading changes', async () => {
        const dune = await book('Dune');

        await sent(camille, '/books/' + dune.id + '/reading', 'PUT', { read: true });
        await sent(camille, '/books/' + dune.id + '/note', 'PUT', { text: 'A private thought' });
        const page = await signedIn('morgan');

        await openActivity(page);

        expect(await actions(page)).toEqual(['You added Dune']);
        expect(await page.getByText('A private thought').count()).toBe(0);
    });

    it('loads older entries after the first twenty', async () => {
        for (let index = 0; index < 21; index++) {
            await sent(camille, '/tags', 'POST', { name: 'Tag ' + String(index).padStart(2, '0') });
        }

        const page = await signedIn('camille');

        await openActivity(page);
        await page.locator('.activity-entry').nth(19).waitFor();

        await page.getByRole('button', { name: 'Load older activity' }).click();

        await page.getByText('You created the Tag 00 tag').waitFor();
        expect(await page.locator('.activity-entry').count()).toBe(21);
        expect(await page.getByRole('button', { name: 'Load older activity' }).count()).toBe(0);
    });

    it('explains an empty Activity to a Guest', async () => {
        const page = await signedIn('morgan');

        await openActivity(page);

        await page.getByText('No shared activity yet.').waitFor();
        await capture(page, 'activity-empty-1280');
    });
});
