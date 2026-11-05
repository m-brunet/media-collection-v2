import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import type { BookDto, MembershipDto, NewBookDto } from '../../packages/contracts/src/http.js';
import { administrator, RuntimeFixture } from '../api/runtime-setup.js';
import { Client } from '../api/client.js';
import { BookInputFixture } from '../api/fixtures/book-input.fixture.js';
import { BrowserFixture, capture, viewports } from './browser.js';

const browser = new BrowserFixture();
let runtime: RuntimeFixture;
let base: string;
let admin: Client;
let edition = 0;

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
    await administrator(admin);
    await account('camille', 'owner');
    await account('morgan', 'guest');
});
afterEach(async () => {
    await browser.closeContexts();
    await runtime.teardown();
});

// A ready account: created by the administrator, temporary password already replaced.
async function account(username: string, role: 'owner' | 'guest') {
    await admin.call('/users', 'POST', { username, password: 'temporary-pw', role });
    const client = new Client(base);

    await client.login(username, 'temporary-pw');
    await client.call('/account/password', 'PATCH', {
        currentPassword: 'temporary-pw',
        password: username + '-password',
    });
}

function membership(name: string, volumeFrom: number, volumeTo = volumeFrom): MembershipDto {
    return { collection: { name }, volumeFrom, volumeTo };
}

// A saved book without ISBN in a collection, arranged through the API.
async function member(
    collection: MembershipDto,
    overrides: Partial<NewBookDto> = {},
): Promise<BookDto> {
    const response = await admin.call<BookDto>(
        '/books',
        'POST',
        BookInputFixture.of({
            title: 'Batman ' + ++edition,
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            authors: [{ name: 'Bob Kane' }],
            category: 'comics',
            collection,
            ...overrides,
        }),
    );

    if (response.status !== 201) {
        throw new Error('Book fixture failed: ' + response.text);
    }

    return response.body;
}

// Marks the collection of a book Finished, as an Owner would, to arrange a scenario.
async function finish(book: BookDto) {
    const response = await admin.call('/collections/' + book.collection!.id + '/finish', 'POST');

    if (response.status !== 200) {
        throw new Error('Finishing failed: ' + response.text);
    }
}

async function signedIn(username: string): Promise<Page> {
    const page = await browser.page(base, { viewport: viewports.referenceDesktop });

    await page.goto('/');
    await page.getByLabel(/^Username/).fill(username);
    await page.getByLabel(/^Password/).fill(username + '-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'My books' }).waitFor();

    return page;
}

async function openCollection(page: Page, name: string) {
    await page.getByRole('link', { name: 'Collections' }).click();
    await page.getByRole('heading', { name: 'Collections' }).waitFor();
    await page
        .getByRole('list')
        .getByRole('link', { name: new RegExp('^' + name) })
        .click();
    await page.getByRole('heading', { name }).waitFor();
}

describe('Collections', () => {
    it('creates a collection from the book form and counts its volumes', async () => {
        const page = await signedIn('camille');

        await page.getByRole('button', { name: 'Add a book' }).first().click();
        await page.getByLabel('This book has no ISBN').check();
        await page.getByLabel(/^Title/).fill('Batman: Year Two');
        await page.getByRole('combobox', { name: 'Add author' }).fill('Mike W. Barr');
        await page.getByRole('option', { name: 'Add “Mike W. Barr” as a new author' }).click();
        await page.getByRole('checkbox', { name: 'Part of a collection' }).check();
        await page.getByRole('combobox', { name: /Collection name/ }).fill('Batman');
        await page.getByRole('textbox', { name: /Volume number/ }).fill('3');
        await page.getByRole('button', { name: 'Save book' }).first().click();
        await page.getByText('Batman: Year Two').first().waitFor();
        await page.getByRole('link', { name: 'Collections' }).click();
        const row = page.getByRole('link', { name: /Batman/ });

        await row.waitFor();

        expect(await row.textContent()).toContain('1 / 3 volumes Owned');
        expect(await row.textContent()).toContain('2 missing · Unfinished');
        await capture(page, 'collections-list');
    });

    it('marks a complete collection Finished, counting an omnibus once', async () => {
        await member(membership('Batman', 1, 3));
        await member(membership('Batman', 2));
        const page = await signedIn('camille');

        await openCollection(page, 'Batman');

        await page.getByRole('button', { name: 'Mark Finished' }).click();

        await page.getByText('Complete · Finished').waitFor();
        expect(await page.getByText('3 of 3 expected volumes Owned').count()).toBe(1);
        await capture(page, 'collection-finished');
    });

    it('lists an omnibus under each volume it covers', async () => {
        await member(membership('Batman', 1, 3));
        await member(membership('Batman', 2));
        const page = await signedIn('camille');

        await openCollection(page, 'Batman');

        await page.getByRole('button', { name: /Volume 2/ }).click();

        const entry = page
            .getByRole('listitem')
            .filter({ has: page.getByRole('button', { name: /Volume 2/ }) });

        expect(await entry.getByText('Omnibus · Covers 1–3 · One book').isVisible()).toBe(true);
        expect(await entry.getByRole('link', { name: /View this book/ }).count()).toBe(2);
    });

    it('reopens a Finished collection when the person chooses to', async () => {
        const book = await member(membership('Batman', 1));

        await finish(book);
        const page = await signedIn('camille');

        await openCollection(page, 'Batman');

        await page.getByRole('button', { name: 'Reopen collection' }).click();

        await page.getByText('No known missing volumes · Unfinished').waitFor();
        expect(await page.getByRole('button', { name: 'Mark Finished' }).isEnabled()).toBe(true);
    });

    it('reopens a Finished collection when a missing volume is saved', async () => {
        const book = await member(membership('Batman', 1));

        await finish(book);

        await member(membership('Batman', 3), { ownership: 'not-owned' });

        const page = await signedIn('camille');

        await openCollection(page, 'Batman');
        expect(await page.getByText('2 missing · Unfinished').count()).toBe(1);
        expect(
            await page
                .getByRole('button', { name: /Volume 3 Missing · Saved Not Owned edition/ })
                .count(),
        ).toBe(1);
    });

    it('replaces a planned volume with the purchased edition after an explicit choice', async () => {
        const planned = await member(membership('Batman', 12), {
            title: 'Batman 12 (planned)',
            ownership: 'not-owned',
        });
        const page = await signedIn('camille');

        await openCollection(page, 'Batman');
        await page.getByRole('button', { name: 'Add a book' }).click();
        await page.getByLabel('This book has no ISBN').check();
        await page.getByLabel(/^Title/).fill('Batman 12 (bought)');
        await page.getByRole('combobox', { name: 'Add author' }).fill('Bob Kane');
        await page.getByRole('option', { name: 'Bob Kane' }).click();
        await page.getByRole('textbox', { name: /Volume number/ }).fill('12');
        await page.getByRole('button', { name: 'Save book' }).first().click();
        const dialog = page.getByRole('dialog', { name: 'This volume is already planned' });

        await dialog.waitFor();
        await capture(page, 'collection-planned-conflict');
        await dialog
            .getByRole('button', { name: 'Delete planned record and add purchased edition' })
            .click();
        await page.getByText('Batman 12 (bought)').first().waitFor();

        expect((await admin.call('/books/' + planned.id)).status).toBe(404);
    });

    it('renames a collection for every member book', async () => {
        const book = await member(membership('Batman', 1));
        const page = await signedIn('camille');

        await openCollection(page, 'Batman');
        await page.getByRole('button', { name: 'Edit collection' }).click();
        const dialog = page.getByRole('dialog', { name: 'Edit collection' });

        await dialog.getByRole('textbox', { name: /Collection name/ }).fill('The Batman');

        await dialog.getByRole('button', { name: 'Save collection' }).click();

        await page.getByRole('heading', { name: 'The Batman' }).waitFor();
        expect((await admin.call<BookDto>('/books/' + book.id)).body.collection?.name).toBe(
            'The Batman',
        );
    });

    it('deletes a collection while keeping its books', async () => {
        const book = await member(membership('Batman', 1));
        const page = await signedIn('camille');

        await openCollection(page, 'Batman');
        await page.getByRole('button', { name: 'Edit collection' }).click();
        await page
            .getByRole('dialog', { name: 'Edit collection' })
            .getByRole('button', { name: 'Delete collection' })
            .click();

        await page
            .getByRole('dialog', { name: 'Delete this collection?' })
            .getByRole('button', { name: 'Delete collection' })
            .click();

        await page.getByText('“Batman” was deleted. Its books were kept.').waitFor();
        expect((await admin.call<BookDto>('/books/' + book.id)).body.collection).toBeNull();
    });

    it('lets a Guest read collections without changing them', async () => {
        await member(membership('Batman', 1));
        const page = await signedIn('morgan');

        await openCollection(page, 'Batman');

        expect(await page.getByRole('button', { name: 'Edit collection' }).count()).toBe(0);
        expect(await page.getByRole('button', { name: 'Mark Finished' }).count()).toBe(0);
        expect(await page.getByRole('button', { name: 'Add a book' }).count()).toBe(0);
    });
});
