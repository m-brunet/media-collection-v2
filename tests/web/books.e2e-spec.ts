import { crc32, deflateSync } from 'node:zlib';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import type { BookDto, NewBookDto } from '../../packages/contracts/src/http.js';
import { administrator, RuntimeFixture } from '../api/runtime-setup.js';
import { Client } from '../api/client.js';
import { BookInputFixture } from '../api/fixtures/book-input.fixture.js';
import { BrowserFixture, capture, viewports } from './browser.js';

const browser = new BrowserFixture();
const png = portraitImage(120, 180);
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
    await administrator(admin);
    await account('camille', 'owner');
    await account('sam', 'owner');
    await account('morgan', 'guest');
});
afterEach(async () => {
    await browser.closeContexts();
    await runtime.teardown();
});

// A plain-coloured PNG with portrait proportions, standing in for a cover photo.
function portraitImage(width: number, height: number): Buffer {
    const chunk = (type: string, data: Buffer) => {
        const body = Buffer.concat([Buffer.from(type), data]);
        const length = Buffer.alloc(4);
        const checksum = Buffer.alloc(4);

        length.writeUInt32BE(data.length);
        checksum.writeUInt32BE(crc32(body));

        return Buffer.concat([length, body, checksum]);
    };
    const header = Buffer.alloc(13);
    const row = Buffer.concat([
        Buffer.from([0]),
        Buffer.alloc(width * 3, Buffer.from([40, 90, 70])),
    ]);

    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header.set([8, 2, 0, 0, 0], 8);

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

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

async function savedBook(overrides: Partial<NewBookDto> = {}): Promise<BookDto> {
    const response = await admin.call<BookDto>('/books', 'POST', BookInputFixture.of(overrides));

    if (response.status !== 201) {
        throw new Error('Book fixture failed: ' + response.text);
    }

    return response.body;
}

async function signedIn(username: string, viewport = viewports.referenceDesktop): Promise<Page> {
    const page = await browser.page(base, { viewport });

    await page.goto('/');
    await page.getByLabel(/^Username/).fill(username);
    await page.getByLabel(/^Password/).fill(username + '-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'My books' }).waitFor();

    return page;
}

async function addAuthor(page: Page, name: string) {
    await page.getByRole('combobox', { name: 'Add author' }).fill(name);
    await page.getByRole('option', { name: 'Add “' + name + '” as a new author' }).click();
}

describe('Adding books', () => {
    it('saves a book entered with an ISBN-10 and explains the conversion on its details', async () => {
        const page = await signedIn('camille');

        await page.getByRole('button', { name: 'Add a book' }).first().click();
        await page.getByLabel(/^ISBN/).fill('0-306-40615-2');
        await page.getByLabel(/^Title/).fill('Piranesi');
        await addAuthor(page, 'Susanna Clarke');
        await page.locator('input[type="file"]').setInputFiles({
            name: 'cover.png',
            mimeType: 'image/png',
            buffer: png,
        });
        await page.getByRole('img', { name: 'Cover of Piranesi' }).waitFor();
        await page.getByRole('button', { name: 'Additional information' }).click();
        await page.getByLabel('Price (€)').fill('16,90');
        await capture(page, 'books-add-form');
        await page.getByRole('button', { name: 'Save book' }).first().click();
        await page.getByRole('heading', { name: 'Book saved' }).waitFor();
        await capture(page, 'books-saved');

        await page.getByRole('button', { name: 'View book' }).click();

        await page.getByRole('heading', { name: 'Piranesi' }).waitFor();
        expect(await page.getByText('9780306406157').isVisible()).toBe(true);
        expect(await page.getByRole('img', { name: 'About this ISBN' }).isVisible()).toBe(true);
        expect(await page.getByText('€16.90').isVisible()).toBe(true);
        expect(await page.getByRole('img', { name: 'Cover of Piranesi' }).isVisible()).toBe(true);
        await capture(page, 'books-details');
    });

    it('lets the person continue after a possible duplicate warning', async () => {
        await savedBook({ isbn: null, noIsbn: true, title: 'Carnet de voyage' });
        const page = await signedIn('camille');

        await page.goto('/books/new');
        expect(await page.getByLabel('Publisher').isVisible()).toBe(false);
        await page.getByLabel('This book has no ISBN').check();
        await page.getByLabel(/^Title/).fill('Carnet de voyage');
        await page.getByRole('combobox', { name: 'Add author' }).fill('susanna');
        await page.getByRole('option', { name: 'Susanna Clarke' }).click();
        await page.getByRole('button', { name: 'Save book' }).first().click();
        const dialog = page.getByRole('dialog', { name: 'This book may already exist' });

        await dialog.waitFor();
        await capture(page, 'books-duplicate-warning');
        await dialog.getByRole('button', { name: 'Continue with this edition' }).click();

        await page.getByRole('heading', { name: 'Book saved' }).waitFor();
    });

    it('asks before leaving a form with unsaved changes', async () => {
        const page = await signedIn('camille');

        await page.goto('/books/new');
        await page.getByLabel(/^Title/).fill('Draft');

        await page.getByRole('link', { name: 'My account' }).click();

        await page.getByRole('dialog', { name: 'Discard your changes?' }).waitFor();
        await capture(page, 'books-discard');
        await page.getByRole('button', { name: 'Discard changes' }).click();
        await page.getByRole('heading', { name: 'My account' }).waitFor();
    });
});

describe('Reading the library', () => {
    it('finds books by author without accents and sorts them', async () => {
        await savedBook({ title: 'Vipère au poing', authors: [{ name: 'Hervé Bazin' }] });
        await savedBook({
            title: 'Dune',
            isbn: '9780306406157',
            authors: [{ name: 'Frank Herbert' }],
        });
        const page = await signedIn('camille', viewports.minimumDesktop);

        await page.getByRole('searchbox', { name: 'Search books' }).fill('herve');

        await page.getByText('1 of 2 books').waitFor();
        expect(await page.getByRole('link', { name: /Vipère au poing/ }).isVisible()).toBe(true);
        expect(await page.getByRole('link', { name: /Dune/ }).count()).toBe(0);
        await page.getByRole('searchbox', { name: 'Search books' }).fill('');
        await page
            .getByRole('combobox', { name: 'Sort books' })
            .selectOption({ label: 'Title Z–A' });
        await page.getByRole('link', { name: /Dune/ }).waitFor();
        const titles = await page.locator('.book-card__title').allTextContents();

        expect(titles).toEqual(['Vipère au poing', 'Dune']);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
            viewports.minimumDesktop.width,
        );
        await capture(page, 'books-list-1280');
    });

    it('keeps a Guest to reading, without personal reading information', async () => {
        const book = await savedBook();
        const page = await signedIn('morgan');

        await page.getByRole('link', { name: /Piranesi/ }).click();

        await page.getByRole('heading', { name: 'Piranesi' }).waitFor();
        expect(await page.getByRole('button', { name: 'Add a book' }).count()).toBe(0);
        expect(await page.getByRole('button', { name: 'Edit book' }).count()).toBe(0);
        expect(await page.getByText('Only your reading').count()).toBe(0);
        expect(await page.getByText(/private note/).count()).toBe(0);
        await capture(page, 'books-details-guest');
        await page.goto('/books/' + book.id + '/edit');
        await page.getByText('This page is unavailable').waitFor();
    });

    it('keeps reading status and notes private to each Owner', async () => {
        await savedBook();
        const camille = await signedIn('camille');

        await camille.getByRole('link', { name: /Piranesi/ }).click();
        await camille.getByRole('button', { name: 'Read' }).click();
        await camille.getByText('Your status: Read.').waitFor();
        await camille.getByRole('button', { name: 'Add a personal note' }).click();
        await camille.getByLabel(/Personal note/).fill('Only for me.');
        await camille.getByRole('button', { name: 'Save note' }).click();
        await camille.getByText('Note saved.').waitFor();
        const sam = await signedIn('sam');

        await sam.getByRole('link', { name: /Piranesi/ }).click();

        await sam.getByText('Your status: Not read.').waitFor();
        expect(await sam.getByText('Only for me.').count()).toBe(0);
        expect(await sam.getByRole('button', { name: 'Add a personal note' }).isVisible()).toBe(
            true,
        );
    });

    it('deletes a book after confirmation', async () => {
        await savedBook();
        const page = await signedIn('camille');

        await page.getByRole('link', { name: /Piranesi/ }).click();
        await page.getByRole('button', { name: 'Delete book' }).click();
        await page
            .getByRole('dialog', { name: 'Delete this book?' })
            .getByRole('button', { name: 'Delete book' })
            .click();

        await page.getByText('“Piranesi” was deleted.').waitFor();
        await page.getByText(/Your shared library is empty/).waitFor();
    });
});
