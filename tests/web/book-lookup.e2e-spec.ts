import { crc32, deflateSync } from 'node:zlib';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import type { BookDto, NewBookDto } from '../../packages/contracts/src/http.js';
import { RuntimeFixture, RuntimeSetup } from '../api/runtime-setup.js';
import { Client } from '../api/client.js';
import { BookInputFixture } from '../api/fixtures/book-input.fixture.js';
import { BrowserFixture, capture, viewports } from './browser.js';
import { LookupSourcesStub } from './lookup-sources-stub.js';

const ewilan = '9782253164692';
const unknown = '9780000000002';
const browser = new BrowserFixture();
const sources = new LookupSourcesStub(portraitImage(200, 300));
let runtime: RuntimeFixture;
let base: string;
let admin: Client;

beforeAll(async () => {
    await browser.launch();
    await sources.start();
});
afterAll(async () => {
    await browser.close();
    await sources.close();
});
beforeEach(async () => {
    runtime = new RuntimeFixture();
    const started = await runtime.start(undefined, { lookupAddresses: sources.addresses });

    base = started.client.base;
    admin = started.client;
    await RuntimeSetup.administrator(admin);
    await owner('camille');
    sources.bnf(ewilan, 'bnf-ewilan-1.xml').openLibrary(ewilan, {
        title: "La quête d'Ewilan",
        authors: ['Pierre Bottero'],
        publisher: 'Le livre de poche',
        cover: true,
    });
});
afterEach(async () => {
    sources.reset();
    await browser.closeContexts();
    await runtime.teardown();
});

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
        Buffer.alloc(width * 3, Buffer.from([150, 60, 40])),
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

async function owner(username: string) {
    await admin.call('/users', 'POST', { username, password: 'temporary-pw', role: 'owner' });
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

async function addBookWith(isbn: string, viewport = viewports.referenceDesktop): Promise<Page> {
    const page = await browser.page(base, { viewport });

    await page.goto('/');
    await page.getByLabel(/^Username/).fill('camille');
    await page.getByLabel(/^Password/).fill('camille-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    await page.getByRole('link', { name: 'Library', exact: true }).click();
    await page.getByRole('heading', { name: 'Library', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Add a book' }).first().click();
    await page.getByLabel(/^ISBN/).fill(isbn);

    return page;
}

function sourceRequests(): string[] {
    return sources.requests.filter((path) => !path.startsWith('/covers/'));
}

describe('Find book', () => {
    it('fills the form from BnF and Open Library and saves the book with its cover', async () => {
        const page = await addBookWith(ewilan);

        await page.getByRole('button', { name: 'Find book' }).click();
        const review = page.getByRole('dialog', { name: 'Review the lookup result' });

        await review.waitFor();
        await capture(page, 'lookup-review');
        await review.getByRole('button', { name: 'Use these values' }).click();
        await page.getByRole('img', { name: /^Cover of/ }).waitFor();
        await page.getByRole('button', { name: 'Save book' }).first().click();
        await page.getByRole('heading', { name: 'Book saved' }).waitFor();

        await page.getByRole('button', { name: 'View book' }).click();

        await page.getByRole('heading', { name: "D'un monde à l'autre" }).waitFor();
        expect(await page.getByText('Pierre Bottero').first().isVisible()).toBe(true);
        expect(await page.getByText(ewilan).isVisible()).toBe(true);
        expect(
            await page.getByRole('img', { name: "Cover of D'un monde à l'autre" }).isVisible(),
        ).toBe(true);
        expect(sourceRequests()).toEqual(['/bnf/SRU', '/openlibrary/api/books']);
        await capture(page, 'lookup-saved-details');
    });

    it('offers the other source’s value as an alternative and uses the one picked', async () => {
        const page = await addBookWith(ewilan);

        await page.getByRole('button', { name: 'Find book' }).click();
        const review = page.getByRole('dialog', { name: 'Review the lookup result' });

        await review.getByRole('radio', { name: /Le livre de poche/ }).click();
        await review.getByRole('button', { name: 'Use these values' }).click();

        expect(await page.getByLabel('Publisher').inputValue()).toBe('Le livre de poche');
    });

    it('opens the book that already has this ISBN without asking any source', async () => {
        await savedBook({ isbn: ewilan, title: 'Ewilan déjà là' });
        const page = await addBookWith(ewilan);

        await page.getByRole('button', { name: 'Find book' }).click();

        await page.getByRole('heading', { name: 'Ewilan déjà là' }).waitFor();
        expect(sourceRequests()).toEqual([]);
    });

    it('keeps a typed title when the person keeps their value', async () => {
        const page = await addBookWith(ewilan);

        await page.getByLabel(/^Title/).fill('Ewilan, tome 1');
        await page.getByRole('button', { name: 'Find book' }).click();
        await page.getByRole('button', { name: 'Use these values' }).click();
        const conflicts = page.getByRole('dialog', { name: 'Replace your entered values?' });

        await conflicts.waitFor();
        await capture(page, 'lookup-conflicts');
        await conflicts.getByRole('button', { name: 'Apply' }).click();

        expect(await page.getByLabel(/^Title/).inputValue()).toBe('Ewilan, tome 1');
        expect(await page.getByLabel('Publisher').inputValue()).toBe(
            'Librairie générale française',
        );
    });

    it('says when no source knows the ISBN and keeps it for manual entry', async () => {
        const page = await addBookWith(unknown);

        await page.getByRole('button', { name: 'Find book' }).click();

        await page
            .getByText('No book was found for this ISBN. It is kept: complete the form manually.')
            .waitFor();
        expect(await page.getByLabel(/^ISBN/).inputValue()).toBe(unknown);
        expect(await page.getByRole('dialog').count()).toBe(0);
        await capture(page, 'lookup-no-result');
    });

    it('says the sources are unavailable, then finds the book on retry', async () => {
        sources.trouble('bnf', { status: 500 }).trouble('openlibrary', { status: 500 });
        const page = await addBookWith(ewilan);

        await page.getByRole('button', { name: 'Find book' }).click();
        await page
            .getByText(
                'Book lookup is unavailable (BnF, Open Library). Your ISBN is kept. Retry or complete this form manually.',
            )
            .waitFor();
        await capture(page, 'lookup-unavailable');
        sources.recover('bnf').recover('openlibrary');

        await page.getByRole('button', { name: 'Retry lookup' }).click();

        await page.getByRole('dialog', { name: 'Review the lookup result' }).waitFor();
        expect(await page.getByLabel(/^ISBN/).inputValue()).toBe(ewilan);
    });

    it('uses what Open Library knows while BnF asks to retry later, and says so', async () => {
        sources.trouble('bnf', { status: 503, retryAfterSeconds: 60 });
        const page = await addBookWith(ewilan);

        await page.getByRole('button', { name: 'Find book' }).click();
        const review = page.getByRole('dialog', { name: 'Review the lookup result' });

        await review.getByRole('button', { name: 'Use these values' }).click();

        expect(await page.getByLabel('Publisher').inputValue()).toBe('Le livre de poche');
        await page
            .getByText('Some sources did not answer (BnF); the values found may be incomplete.')
            .waitFor();
    });

    it('refuses an image address inside the home network without fetching it', async () => {
        const page = await addBookWith(ewilan);

        await page
            .getByLabel('Image address')
            .fill(sources.addresses.bnf.replace('/bnf/SRU', '/covers/private.png'));

        await page.getByRole('button', { name: 'Use this image' }).click();

        await page.getByRole('alert').filter({ hasText: 'No usable image was found' }).waitFor();
        expect(sources.requests).toEqual([]);
        expect(await page.getByRole('img', { name: /^Cover of/ }).count()).toBe(0);
    });

    it('fits the review in a 1280 px window without horizontal scrolling', async () => {
        const page = await addBookWith(ewilan, viewports.minimumDesktop);

        await page.getByRole('button', { name: 'Find book' }).click();

        await page.getByRole('dialog', { name: 'Review the lookup result' }).waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
            viewports.minimumDesktop.width,
        );
        await capture(page, 'lookup-review-1280');
    });
});
