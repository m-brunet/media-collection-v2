import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import type { BookDto, MembershipDto } from '../../packages/contracts/src/http.js';
import { RuntimeFixture, RuntimeSetup } from '../api/runtime-setup.js';
import { Client } from '../api/client.js';
import { BookInputFixture } from '../api/fixtures/book-input.fixture.js';
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
    await RuntimeSetup.administrator(admin);
    await account('camille', 'owner');
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

function membership(name: string, volume: number): MembershipDto {
    return { collection: { name }, volumeFrom: volume, volumeTo: volume };
}

// A Manga of the collection saved without title through the API, so its title is generated.
async function generated(collection: MembershipDto): Promise<BookDto> {
    const response = await admin.call<BookDto>(
        '/books',
        'POST',
        BookInputFixture.of({
            title: '',
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            authors: [{ name: 'Yukito Kishiro' }],
            category: 'manga',
            collection,
        }),
    );

    if (response.status !== 201) {
        throw new Error('Book fixture failed: ' + response.text);
    }

    return response.body;
}

async function stored(book: BookDto) {
    return (await admin.call<BookDto>('/books/' + book.id)).body;
}

async function signedIn(username: string): Promise<Page> {
    const page = await browser.page(base, { viewport: viewports.referenceDesktop });

    await page.goto('/');
    await page.getByLabel(/^Username/).fill(username);
    await page.getByLabel(/^Password/).fill(username + '-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    await page.getByRole('link', { name: 'My books' }).click();
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

describe('Generated titles', () => {
    it('names a Manga saved without title after its collection and volume', async () => {
        const page = await signedIn('camille');

        await page.getByRole('button', { name: 'Add a book' }).first().click();
        await page.getByLabel('This book has no ISBN').check();
        await page.getByRole('combobox', { name: 'Add author' }).fill('Yukito Kishiro');
        await page.getByRole('option', { name: 'Add “Yukito Kishiro” as a new author' }).click();
        await page.getByLabel(/^Category/).selectOption('manga');
        await page.getByRole('checkbox', { name: 'Part of a collection' }).check();
        await page.getByRole('combobox', { name: /Collection name/ }).fill('Gunnm');
        await page.getByRole('textbox', { name: /Volume number/ }).fill('3');
        await page
            .getByText(
                'Optional: leave it empty to name the book from its collection, “Gunnm Vol. 3”.',
            )
            .waitFor();
        await capture(page, 'generated-title-form');

        await page.getByRole('button', { name: 'Save book' }).first().click();

        await page.getByText('Gunnm Vol. 3').first().waitFor();
        expect((await admin.call<{ items: BookDto[] }>('/books')).body.items[0]).toMatchObject({
            title: 'Gunnm Vol. 3',
        });
    });

    it('renames the generated titles with their collection', async () => {
        const book = await generated(membership('Gunnm', 3));
        const page = await signedIn('camille');

        await openCollection(page, 'Gunnm');
        await page.getByRole('button', { name: 'Edit collection' }).click();
        const dialog = page.getByRole('dialog', { name: 'Edit collection' });

        await dialog.getByRole('textbox', { name: /Collection name/ }).fill('Battle Angel Alita');

        await dialog.getByRole('button', { name: 'Save collection' }).click();

        await page.getByRole('heading', { name: 'Battle Angel Alita' }).waitFor();
        expect(await stored(book)).toMatchObject({
            title: 'Battle Angel Alita Vol. 3',
            titleGenerated: true,
        });
    });

    it('keeps the last generated title, in one save, when the book leaves its collection', async () => {
        const book = await generated(membership('Gunnm', 3));
        const page = await signedIn('camille');

        await page.goto('/books/' + book.id + '/edit');
        await page.getByRole('checkbox', { name: 'Part of a collection' }).uncheck();

        await page.getByRole('button', { name: 'Save changes' }).first().click();

        await page.getByRole('heading', { name: 'Gunnm Vol. 3' }).waitFor();
        expect(await page.getByText('Named from its collection').count()).toBe(0);
        expect(await stored(book)).toMatchObject({ title: 'Gunnm Vol. 3', titleGenerated: false });
    });

    it('keeps the titles of the books of a deleted collection', async () => {
        const book = await generated(membership('Gunnm', 3));
        const page = await signedIn('camille');

        await openCollection(page, 'Gunnm');
        await page.getByRole('button', { name: 'Edit collection' }).click();
        await page
            .getByRole('dialog', { name: 'Edit collection' })
            .getByRole('button', { name: 'Delete collection' })
            .click();

        await page
            .getByRole('dialog', { name: 'Delete this collection?' })
            .getByRole('button', { name: 'Delete collection' })
            .click();

        await page.getByText('“Gunnm” was deleted. Its books were kept.').waitFor();
        expect(await stored(book)).toMatchObject({
            title: 'Gunnm Vol. 3',
            titleGenerated: false,
            collection: null,
        });
    });

    it('shows a lent book under its regenerated title on the Lent books page', async () => {
        const book = await generated(membership('Gunnm', 3));

        await admin.call('/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: [book.id],
        });
        await admin.call('/collections/' + book.collection!.id, 'PATCH', { name: 'Alita' });
        const page = await signedIn('camille');

        await page.getByRole('link', { name: 'Loans' }).click();

        const sam = page.getByRole('region', { name: 'Sam Taylor' });

        await sam.waitFor();
        expect(await sam.getByRole('link', { name: 'Alita Vol. 3' }).count()).toBe(1);
    });
});
