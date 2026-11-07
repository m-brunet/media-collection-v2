import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import sharp from 'sharp';
import type { BookDto, NewBookDto } from '../../packages/contracts/src/http.js';
import { administrator, RuntimeFixture } from '../api/runtime-setup.js';
import { Client } from '../api/client.js';
import { BookInputFixture } from '../api/fixtures/book-input.fixture.js';
import { BarcodePictures } from './barcode-pictures.js';
import { BrowserFixture, capture, viewports } from './browser.js';
import { LookupSourcesStub } from './lookup-sources-stub.js';

const ewilan = '9782253164692';
const unknown = '9780000000002';
const piranesi = '9781635575637';
// A page opened over plain HTTP from another device gets no live camera: the photo path.
const plainHttpPage = "Object.defineProperty(window, 'isSecureContext', { value: false });";
const browser = new BrowserFixture();
const sources = new LookupSourcesStub(
    await sharp({ create: { width: 200, height: 300, channels: 3, background: '#963c28' } })
        .png()
        .toBuffer(),
);
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
    await administrator(admin);
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

// A ready Owner account: created by the administrator, temporary password already replaced.
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

// Camille on Leaf's home, on a phone.
async function leafHome(
    fixture = browser,
    options: { beforeLoad?: string; permissions?: string[] } = { beforeLoad: plainHttpPage },
): Promise<Page> {
    const page = await fixture.page(base, { viewport: viewports.phone, ...options });

    await page.goto('/leaf/');
    await page.getByLabel(/^Username/).fill('camille');
    await page.getByLabel(/^Password/).fill('camille-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Your collections, wherever you shop.' }).waitFor();

    return page;
}

// Scan a book, then photograph the barcode with the phone's camera app.
async function scanPhoto(page: Page, isbn: string): Promise<void> {
    await page.getByRole('link', { name: /Scan a book/ }).click();
    const chooser = page.waitForEvent('filechooser');

    await page.getByRole('button', { name: 'Take a photo of the barcode' }).click();
    await (
        await chooser
    ).setFiles({
        name: 'barcode.png',
        mimeType: 'image/png',
        buffer: await BarcodePictures.photo(isbn),
    });
    await page.getByRole('heading', { name: 'Ready to find this book' }).waitFor();
}

async function noHorizontalScrolling(page: Page): Promise<boolean> {
    return (
        (await page.evaluate(() => document.documentElement.scrollWidth)) <= viewports.phone.width
    );
}

function sourceRequests(): string[] {
    return sources.requests.filter((path) => !path.startsWith('/covers/'));
}

describe('Scan and add a book', () => {
    it('adds a new book from a barcode photo after Find book and the review', async () => {
        const page = await leafHome();

        await scanPhoto(page, ewilan);
        await page.getByRole('button', { name: 'Find book' }).click();
        await page.getByRole('heading', { name: 'Review book' }).waitFor();
        await page.getByAltText('Chosen cover').waitFor();

        await page.getByRole('button', { name: 'Save book' }).click();

        await page.getByRole('heading', { name: 'Book added' }).waitFor();
        const books = await admin.call<{ items: { title: string; hasCover: boolean }[] }>('/books');

        expect(books.body.items).toEqual([
            expect.objectContaining({ title: "D'un monde à l'autre", hasCover: true }),
        ]);
        await capture(page, 'leaf-book-added');
    });

    it('shows the review of the lookup result without horizontal scrolling', async () => {
        const page = await leafHome();

        await scanPhoto(page, ewilan);

        await page.getByRole('button', { name: 'Find book' }).click();

        await page.getByRole('heading', { name: 'Review book' }).waitFor();
        expect(await page.getByLabel(/^Title/).inputValue()).toBe("D'un monde à l'autre");
        expect(await noHorizontalScrolling(page)).toBe(true);
        await capture(page, 'leaf-review-book');
    });

    it('starts another scan from the success screen', async () => {
        const page = await leafHome();

        await scanPhoto(page, ewilan);
        await page.getByRole('button', { name: 'Find book' }).click();
        await page.getByRole('button', { name: 'Save book' }).click();
        await page.getByRole('heading', { name: 'Book added' }).waitFor();

        await page.getByRole('button', { name: 'Scan another book' }).click();

        await page.getByRole('button', { name: 'Take a photo of the barcode' }).waitFor();
    });

    it('explains a refused camera and offers Retry or Back to home', async () => {
        const page = await leafHome(browser, {});

        await page.getByRole('link', { name: /Scan a book/ }).click();

        await page.getByRole('heading', { name: 'Camera unavailable' }).waitFor();
        expect(await page.getByRole('button', { name: 'Retry' }).isVisible()).toBe(true);
        expect(await page.getByRole('link', { name: 'Back to home' }).isVisible()).toBe(true);
        expect(await page.getByRole('textbox').count()).toBe(0);
        await capture(page, 'leaf-camera-unavailable');
    });

    it('says an Owned ISBN is already owned without asking any source', async () => {
        await savedBook({ isbn: piranesi });
        const page = await leafHome();

        await scanPhoto(page, piranesi);

        await page.getByRole('button', { name: 'Find book' }).click();

        await page.getByRole('heading', { name: 'Already owned' }).waitFor();
        expect(sourceRequests()).toEqual([]);
        await capture(page, 'leaf-already-owned');
    });

    it('marks a registered Not Owned book Owned without asking any source', async () => {
        const planned = await savedBook({ isbn: piranesi, ownership: 'not-owned' });
        const page = await leafHome();

        await scanPhoto(page, piranesi);
        await page.getByRole('button', { name: 'Find book' }).click();
        await page.getByRole('heading', { name: 'Already registered' }).waitFor();

        await page.getByRole('button', { name: 'Mark as Owned' }).click();

        await page.getByRole('heading', { name: 'Now Owned' }).waitFor();
        const book = await admin.call<BookDto>('/books/' + planned.id);

        expect(book.body.ownership).toBe('owned');
        expect(sourceRequests()).toEqual([]);
    });

    it('allows one Retry, then only Back to home, when both sources fail', async () => {
        sources.trouble('bnf', { status: 500 }).trouble('openlibrary', { status: 500 });
        const page = await leafHome();

        await scanPhoto(page, unknown);
        await page.getByRole('button', { name: 'Find book' }).click();
        await page.getByRole('heading', { name: 'Could not find book details' }).waitFor();

        await page.getByRole('button', { name: 'Retry' }).click();

        await page.getByRole('heading', { name: 'Lookup unavailable' }).waitFor();
        expect(await page.getByRole('button', { name: 'Retry' }).count()).toBe(0);
        expect(await page.getByRole('textbox').count()).toBe(0);
        expect(await page.getByRole('link', { name: 'Back to home' }).isVisible()).toBe(true);
        await capture(page, 'leaf-retry-exhausted');
    });
});

// Chromium's fake camera plays a video of the barcode; Leaf's reader reads the live frames.
describe('Scan with the live camera', () => {
    const camera = new BrowserFixture();
    let directory: string;

    beforeAll(async () => {
        directory = mkdtempSync(join(tmpdir(), 'leaf-camera-'));
        await camera.launch([
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--use-file-for-fake-video-capture=' + (await BarcodePictures.video(ewilan, directory)),
        ]);
    });
    afterEach(async () => {
        await camera.closeContexts();
    });
    afterAll(async () => {
        await camera.close();
        rmSync(directory, { recursive: true, force: true });
    });

    it('reads the barcode in the camera view when the page allows it', async () => {
        const page = await leafHome(camera, { permissions: ['camera'] });

        await page.getByRole('link', { name: /Scan a book/ }).click();

        await page.getByRole('heading', { name: 'Ready to find this book' }).waitFor();
        expect(await page.getByText(ewilan).isVisible()).toBe(true);
        expect(sourceRequests()).toEqual([]);
    });
});
