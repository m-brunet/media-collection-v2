import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import type {
    BookcaseDto,
    BookDto,
    NewBookDto,
    ShelfDto,
    TagDto,
} from '../../packages/contracts/src/http.js';
import { RuntimeFixture, RuntimeSetup } from '../api/runtime-setup.js';
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
    await RuntimeSetup.administrator(admin);
    await account('camille', 'owner');
    await account('morgan', 'guest');
});
afterEach(async () => {
    await browser.closeContexts();
    await runtime.teardown();
});

async function account(username: string, role: 'owner' | 'guest') {
    await admin.call('/users', 'POST', { username, password: 'temporary-pw', role });
    const client = new Client(base);

    await client.login(username, 'temporary-pw');
    await client.call('/account/password', 'PATCH', {
        currentPassword: 'temporary-pw',
        password: username + '-password',
    });
}

async function created<T>(path: string, body: object): Promise<T> {
    const response = await admin.call<T>(path, 'POST', body);

    if (response.status !== 201) {
        throw new Error('Fixture failed on ' + path + ': ' + response.text);
    }

    return response.body;
}

async function bookcase(name: string, shelves: string[]) {
    const saved = await created<BookcaseDto>('/bookcases', { name });
    const made: ShelfDto[] = [];

    for (const shelf of shelves) {
        made.push(await created<ShelfDto>('/bookcases/' + saved.id + '/shelves', { name: shelf }));
    }

    return { ...saved, shelves: made };
}

async function book(title: string, overrides: Partial<NewBookDto> = {}): Promise<BookDto> {
    return created<BookDto>(
        '/books',
        BookInputFixture.of({
            title: title + ' ' + ++edition,
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            ...overrides,
        }),
    );
}

async function renamed(path: string, name: string) {
    const response = await admin.call(path, 'PATCH', { name });

    if (response.status !== 200) {
        throw new Error('Renaming failed on ' + path + ': ' + response.text);
    }
}

async function signedIn(
    username: string,
    viewport: { width: number; height: number } = viewports.referenceDesktop,
): Promise<Page> {
    const page = await browser.page(base, { viewport });

    await page.goto('/');
    await page.getByLabel(/^Username/).fill(username);
    await page.getByLabel(/^Password/).fill(username + '-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    await page.getByRole('link', { name: 'Library', exact: true }).click();
    await page.getByRole('heading', { name: 'Library', exact: true }).waitFor();

    return page;
}

async function openBookshelves(page: Page) {
    await page.getByRole('link', { name: 'Bookshelves' }).click();
    await page.getByRole('heading', { name: 'Bookshelves' }).waitFor();
}

function strip(page: Page) {
    return page.getByRole('navigation', { name: 'Bookcases' });
}

describe('Bookshelves', () => {
    it('keeps an empty bookcase and shelf available for later assignments', async () => {
        const page = await signedIn('camille');

        await openBookshelves(page);
        await page.getByRole('button', { name: 'Create bookcase' }).click();
        await page.getByLabel(/Bookcase name/).fill('Oak bookcase');
        await page.getByRole('dialog').getByRole('button', { name: 'Create bookcase' }).click();
        await page.getByText('“Oak bookcase” was created.').waitFor();
        await page.getByRole('button', { name: 'Add shelf' }).click();
        await page.getByLabel(/Shelf name/).fill('Top');

        await page.getByRole('button', { name: 'Create shelf' }).click();

        await page.getByRole('button', { name: 'Top · 0 books' }).waitFor();
        expect(await page.getByText('1 bookcase · 1 shelf · 0 books').count()).toBe(1);
        await capture(page, 'bookshelves');
    });

    it('renames a bookcase', async () => {
        await bookcase('Oak bookcase', ['Shelf 3']);
        const page = await signedIn('camille');

        await openBookshelves(page);
        await page.getByRole('button', { name: 'Edit bookcase' }).click();
        await page.getByLabel(/Bookcase name/).fill('Walnut bookcase');

        await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();

        await page.getByRole('heading', { level: 2, name: 'Walnut bookcase' }).waitFor();
        expect(await strip(page).getByText('Walnut bookcase').count()).toBe(1);
    });

    it('shows a renamed bookcase on the books kept in it', async () => {
        const oak = await bookcase('Oak bookcase', ['Shelf 3']);
        const piranesi = await book('Piranesi', { shelfId: oak.shelves[0]!.id });

        await renamed('/bookcases/' + oak.id, 'Walnut bookcase');
        const page = await signedIn('camille');

        await page.goto('/books/' + piranesi.id);

        await page.getByRole('heading', { name: piranesi.title }).waitFor();
        expect(await page.getByLabel('Physical location').inputValue()).toBe(oak.shelves[0]!.id);
        expect(await page.getByRole('option', { name: 'Walnut bookcase – Shelf 3' }).count()).toBe(
            1,
        );
    });

    it('moves a shelf with its books to another bookcase', async () => {
        const oak = await bookcase('Oak bookcase', ['Top', 'Middle']);

        await bookcase('Study bookcase', ['top']);
        await book('Dune', { shelfId: oak.shelves[1]!.id });
        const page = await signedIn('camille');

        await page.goto('/bookshelves?shelf=' + oak.shelves[1]!.id);
        await page.getByRole('button', { name: 'Move shelf' }).click();
        await page
            .getByRole('dialog')
            .getByLabel(/^Bookcase/)
            .selectOption({ label: 'Study bookcase' });

        await page.getByRole('dialog').getByRole('button', { name: 'Move shelf' }).click();

        await page.getByText('“Middle” is now in Study bookcase.').waitFor();
        await page.getByRole('button', { name: 'Middle · 1 book' }).waitFor();
        expect(await page.getByRole('heading', { level: 2 }).first().textContent()).toBe(
            'Study bookcase',
        );
    });

    it('refuses to move a shelf next to an equivalent name', async () => {
        const oak = await bookcase('Oak bookcase', ['Top']);

        await bookcase('Study bookcase', ['TOP']);
        const page = await signedIn('camille');

        await page.goto('/bookshelves?shelf=' + oak.shelves[0]!.id);
        await page.getByRole('button', { name: 'Move shelf' }).click();
        await page
            .getByRole('dialog')
            .getByLabel(/^Bookcase/)
            .selectOption({ label: 'Study bookcase' });

        await page.getByRole('dialog').getByRole('button', { name: 'Move shelf' }).click();

        await page
            .getByText('This bookcase already has a shelf with an equivalent name.')
            .waitFor();
        expect(await page.getByRole('dialog').isVisible()).toBe(true);
    });

    it('deletes a shelf and keeps its books, now without a location', async () => {
        const oak = await bookcase('Oak bookcase', ['Shelf 3']);
        const dune = await book('Dune', { shelfId: oak.shelves[0]!.id });
        const page = await signedIn('camille');

        await openBookshelves(page);
        await page.getByRole('button', { name: 'Delete shelf' }).click();
        await page
            .getByText('1 book will become unassigned. No books will be deleted.', { exact: false })
            .waitFor();

        await page.getByRole('dialog').getByRole('button', { name: 'Delete shelf' }).click();

        await page.getByText('“Shelf 3” was deleted. Its books were kept.').waitFor();
        expect((await admin.call<BookDto>('/books/' + dune.id)).body.location).toBeNull();
    });
});

describe('Add books to a shelf', () => {
    it('places loose books and moves a shelved one, then shows the shelf with its new count', async () => {
        const oak = await bookcase('Oak bookcase', ['Shelf 3']);
        const hall = await bookcase('Hallway', ['Shelf 1']);
        const dune = await book('Dune');
        const emma = await book('Emma');
        const mort = await book('Mort', { shelfId: hall.shelves[0]!.id });
        const page = await signedIn('camille');

        await page.goto('/bookshelves?shelf=' + oak.shelves[0]!.id);
        await page.getByRole('button', { name: 'Add books' }).click();
        await page.getByRole('heading', { name: 'Add books to Shelf 3' }).waitFor();
        await page.getByRole('checkbox', { name: dune.title }).check();
        await page.getByRole('checkbox', { name: emma.title }).check();
        await page.getByRole('button', { name: 'Remove the filter No physical location' }).click();
        await page.getByRole('checkbox', { name: mort.title }).check();
        await page.getByText('2 placed on Shelf 3 · 1 moved from Hallway – Shelf 1').waitFor();
        await capture(page, 'add-books-to-shelf');

        await page.getByRole('button', { name: 'Place 3 books on Shelf 3' }).click();

        await page.getByText('3 books are now on Shelf 3:', { exact: false }).waitFor();
        await page.getByRole('heading', { name: 'Bookshelves' }).waitFor();
        expect(
            await Promise.all(
                [dune, emma, mort].map(
                    async (saved) =>
                        (await admin.call<BookDto>('/books/' + saved.id)).body.location?.shelfId,
                ),
            ),
        ).toEqual([oak.shelves[0]!.id, oak.shelves[0]!.id, oak.shelves[0]!.id]);
    });

    it('fits the smallest desktop window without horizontal scrolling', async () => {
        await bookcase('Oak bookcase', ['Shelf 3']);
        await book('Dune');
        const page = await signedIn('camille', viewports.minimumDesktop);

        await openBookshelves(page);
        await page.getByRole('button', { name: 'Add books' }).click();
        await page.getByRole('table', { name: 'Books to add to Shelf 3' }).waitFor();

        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
            ),
        ).toBe(true);
    });
});

describe('Bookshelves Wall', () => {
    async function shelved(viewport?: { width: number; height: number }) {
        const oak = await bookcase('Oak bookcase', ['Shelf 1', 'Shelf 2']);

        for (const title of ['Dune', 'Emma', 'Hyperion']) {
            await book(title, { shelfId: oak.shelves[0]!.id });
        }

        const page = await signedIn('camille', viewport);

        await openBookshelves(page);
        await spine(page, /^Dune \d+ · Susanna Clarke$/).waitFor();

        return page;
    }

    function spine(page: Page, name: RegExp) {
        return page.getByRole('list', { name: 'Books on Shelf 1' }).getByRole('link', { name });
    }

    function width(page: Page, selector: string) {
        return page
            .locator(selector)
            .first()
            .evaluate((element) => element.getBoundingClientRect().width);
    }

    it('keeps the width of a bay when the window grows', async () => {
        const page = await shelved();
        const before = await width(page, '.wall-shelf__bay');

        await page.setViewportSize({ width: 1920, height: 1080 });

        expect([before, await width(page, '.wall-shelf__bay')]).toEqual([432, 432]);
    });

    it('gives the extra room of a wide window to the shelf panel', async () => {
        const page = await shelved();
        const before = await width(page, '.shelf-panel');

        await page.setViewportSize({ width: 1920, height: 1080 });

        expect(await width(page, '.shelf-panel')).toBeGreaterThan(before);
    });

    it('moves the shelf panel below the bookcase in a narrow window', async () => {
        const page = await shelved({ width: 1000, height: 900 });

        const [bookcase, panel] = await Promise.all(
            ['.wall-bookcase', '.shelf-panel'].map((selector) =>
                page.locator(selector).evaluate((element) => element.getBoundingClientRect()),
            ),
        );

        expect(panel!.top).toBeGreaterThanOrEqual(bookcase!.bottom);
    });

    it('fits the smallest desktop window', async () => {
        const page = await shelved(viewports.minimumDesktop);

        const scrolled = await page.evaluate(() => document.documentElement.scrollWidth);

        expect(scrolled).toBeLessThanOrEqual(viewports.minimumDesktop.width);
    });

    async function chooseWidth(page: Page, size: 'Small' | 'Large') {
        await page.getByRole('button', { name: 'Edit bookcase' }).click();
        const dialog = page.getByRole('dialog', { name: 'Edit bookcase' });

        await dialog.getByText(size, { exact: true }).click();
        await dialog.getByRole('button', { name: 'Save' }).click();
        await dialog.waitFor({ state: 'hidden' });
    }

    it('makes a bookcase Small and keeps it after a reload', async () => {
        const page = await shelved();

        const saved = page.waitForResponse(
            (response) => response.request().method() === 'PATCH' && response.ok(),
        );

        await chooseWidth(page, 'Small');
        await saved;
        await page.reload();
        await spine(page, /^Dune \d+ · Susanna Clarke$/).waitFor();
        await page.getByRole('button', { name: 'Edit bookcase' }).click();

        const bay = await width(page, '.wall-shelf__bay');
        const chosen = page.getByRole('dialog').getByRole('radio', { name: 'Small' });

        expect(bay).toBe(222);
        expect(await chosen.isChecked()).toBe(true);
    });

    it('makes a Small bookcase Large again', async () => {
        const page = await shelved();
        const redrawn = () =>
            page.waitForResponse((response) => response.url().endsWith('/spines') && response.ok());
        const small = redrawn();

        await chooseWidth(page, 'Small');
        await small;
        await spine(page, /^Dune \d+ · Susanna Clarke$/).waitFor();
        const large = redrawn();

        await chooseWidth(page, 'Large');
        await large;
        await spine(page, /^Dune \d+ · Susanna Clarke$/).waitFor();

        const bay = await width(page, '.wall-shelf__bay');

        expect(bay).toBe(432);
    });

    it('moves from spine to spine with the arrow keys', async () => {
        const page = await shelved();

        await spine(page, /^Dune \d+ · Susanna Clarke$/).focus();
        await page.keyboard.press('ArrowRight');

        expect(
            await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
        ).toMatch(/^Emma \d+ · Susanna Clarke$/);
    });
});

describe('Bookshelves Wall v2', () => {
    async function eightBookcases() {
        const made = [];

        for (const [index, shelves] of [5, 5, 7, 7, 5, 6, 4, 5].entries()) {
            made.push(
                await bookcase(
                    'Room ' + (index + 1),
                    Array.from({ length: shelves }, (_, shelf) => 'Shelf ' + (shelf + 1)),
                ),
            );
        }

        await book('Dune', { shelfId: made[0]!.shelves[0]!.id });
        await book('Emma', { shelfId: made[3]!.shelves[1]!.id });

        return made;
    }

    async function wallLine() {
        await eightBookcases();
        const page = await signedIn('camille', { width: 1920, height: 1080 });

        await page.goto('/bookshelves?view=wall-v2');
        await page.getByRole('region', { name: 'Bookcases' }).waitFor();
        await page.getByRole('list', { name: 'Books on Shelf 1' }).first().waitFor();

        return page;
    }

    function scrolls(page: Page) {
        return page.evaluate(() => [
            document.documentElement.scrollWidth > window.innerWidth,
            document.documentElement.scrollHeight > window.innerHeight,
        ]);
    }

    it('shows the line and the shelf panel on one 1920 by 1080 screen, without scrolling', async () => {
        const page = await wallLine();

        const result = await scrolls(page);

        expect(result).toEqual([false, false]);
        await capture(page, 'bookshelves-wall-v2');
    });

    it('moves the line by one bookcase with Next, then shows the covers of a shelf clicked', async () => {
        const page = await wallLine();

        await page.getByRole('button', { name: 'Next bookcases' }).click();
        const room = page.getByRole('region', { name: 'Room 4' });

        await room.getByRole('button', { name: /^Shelf 2/ }).click();

        const heading = page
            .getByRole('complementary', { name: 'Selected shelf' })
            .getByRole('heading', { name: '1 book on Shelf 2' });

        await heading.waitFor({ timeout: 5000 });
        expect(await heading.isVisible()).toBe(true);
    });

    it('keeps the panel and the bookcases still when an empty shelf is selected', async () => {
        const page = await wallLine();
        const panel = page.getByRole('complementary', { name: 'Selected shelf' });
        const room = page.getByRole('region', { name: 'Room 1' });
        const heights = async () =>
            Promise.all(
                [panel, room].map((locator) =>
                    locator.evaluate((element) => element.getBoundingClientRect().height),
                ),
            );
        const before = await heights();

        await room.getByRole('button', { name: /^Shelf 2/ }).click();

        await panel.getByText('No book is on this shelf yet.').waitFor();
        expect(await heights()).toEqual(before);
    });
});

describe('Bookshelves Ribbons', () => {
    async function ribbons(count: number, viewport?: { width: number; height: number }) {
        const oak = await bookcase('Oak bookcase', ['Shelf 1']);

        await bookcase('Study bookcase', ['Top']);

        for (let index = 0; index < count; index++) {
            await book('Book ' + String(index).padStart(2, '0'), { shelfId: oak.shelves[0]!.id });
        }

        const page = await signedIn('camille', viewport);

        await openBookshelves(page);
        await page.getByRole('radio', { name: 'Ribbons' }).click();
        await page.getByRole('tablist', { name: 'Bookcases' }).waitFor();
        await covers(page).first().waitFor();

        return page;
    }

    function covers(page: Page) {
        return page.getByRole('list', { name: 'Books on Shelf 1' }).getByRole('link');
    }

    it('shows thirteen covers and a tile on the reference window', async () => {
        const page = await ribbons(20);

        const shown = await covers(page).count();

        expect([shown, await page.getByRole('button', { name: /^7 more books/ }).count()]).toEqual([
            13, 1,
        ]);
    });

    it('shows more covers on a wide window', async () => {
        const page = await ribbons(30);

        await page.setViewportSize({ width: 1920, height: 1080 });

        await expect.poll(() => covers(page).count()).toBeGreaterThan(13);
    });

    it('moves along a shelf and back with the arrows', async () => {
        const page = await ribbons(20);

        await page.getByRole('button', { name: 'Next books of Shelf 1' }).click();
        await expect
            .poll(() => covers(page).first().getAttribute('aria-label'))
            .toMatch(/^Book 13 /);

        await page.getByRole('button', { name: 'Previous books of Shelf 1' }).click();

        await expect
            .poll(() => covers(page).first().getAttribute('aria-label'))
            .toMatch(/^Book 00 /);
    });

    it('moves between the bookcase tabs with the arrow keys', async () => {
        const page = await ribbons(1);

        await page.getByRole('tab', { name: /^Oak bookcase/ }).focus();

        await page.keyboard.press('ArrowRight');

        await page.getByRole('heading', { level: 2, name: 'Study bookcase' }).waitFor();
        expect(await page.evaluate(() => document.activeElement?.textContent)).toMatch(
            /^Study bookcase/,
        );
    });

    it('lines the View choice up with the New bookcase button', async () => {
        const page = await ribbons(1);

        const [views, create] = await Promise.all(
            [
                page.getByRole('radiogroup', { name: 'View' }),
                page.getByRole('button', { name: 'New bookcase' }),
            ].map((locator) => locator.evaluate((element) => element.getBoundingClientRect())),
        );

        expect([views!.top, views!.height]).toEqual([create!.top, create!.height]);
    });

    it('fits the smallest desktop window', async () => {
        const page = await ribbons(20, viewports.minimumDesktop);

        const scrolled = await page.evaluate(() => document.documentElement.scrollWidth);

        expect(scrolled).toBeLessThanOrEqual(viewports.minimumDesktop.width);
    });
});

describe('Bookshelves Columns', () => {
    async function columns(count: number, viewport?: { width: number; height: number }) {
        const oak = await bookcase('Oak bookcase', ['Shelf 1', 'Shelf 2']);

        for (let index = 0; index < count; index++) {
            await book('Book ' + String(index).padStart(2, '0'), { shelfId: oak.shelves[0]!.id });
        }

        const page = await signedIn('camille', viewport);

        await openBookshelves(page);
        await page.getByRole('radio', { name: 'Columns' }).click();
        await rows(page).first().waitFor();

        return page;
    }

    function rows(page: Page) {
        return page.getByRole('table', { name: 'Books on Shelf 1' }).locator('tbody tr');
    }

    it('loads the following books while the table scrolls', async () => {
        const page = await columns(40);

        await page
            .locator('.columns-view__scroller')
            .evaluate((element) => element.scrollTo({ top: element.scrollHeight }));

        await expect.poll(() => rows(page).count()).toBe(40);
        await page.getByText(/–40 of 40$/).waitFor();
    });

    it('goes through the columns with the arrow keys and opens a book with Enter', async () => {
        const page = await columns(2);

        await page.getByRole('option', { name: /^Oak bookcase/ }).focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');

        await page.keyboard.press('Enter');

        await page.getByRole('heading', { name: /^Book 00 / }).waitFor();
    });

    it('moves a book to another shelf with M and updates the counts', async () => {
        const page = await columns(2);

        await rows(page).first().focus();
        await page.keyboard.press('m');
        await page
            .getByRole('dialog')
            .getByLabel('Physical location')
            .selectOption({ label: 'Oak bookcase – Shelf 2' });

        await page.getByRole('button', { name: 'Move book' }).click();

        await page.getByRole('option', { name: /^Shelf 2\s*1$/ }).waitFor();
        expect(await rows(page).count()).toBe(1);
    });

    it('fits the smallest desktop window', async () => {
        const page = await columns(2, viewports.minimumDesktop);

        const scrolled = await page.evaluate(() => document.documentElement.scrollWidth);

        expect(scrolled).toBeLessThanOrEqual(viewports.minimumDesktop.width);
    });
});

describe('Tags', () => {
    it('reuses an equivalent tag typed in the book form', async () => {
        await created<TagDto>('/tags', { name: 'Science-fiction' });
        const page = await signedIn('camille');

        await page.getByRole('button', { name: 'Add a book' }).first().click();
        await page.getByLabel('This book has no ISBN').check();
        await page.getByLabel(/^Title/).fill('Dune');
        await page.getByRole('combobox', { name: 'Add author' }).fill('Frank Herbert');
        await page.getByRole('option', { name: 'Add “Frank Herbert” as a new author' }).click();
        await page.getByRole('combobox', { name: 'Find or create tag' }).fill(' science-FICTION ');
        await page.getByRole('option', { name: 'Science-fiction' }).click();

        await page.getByRole('button', { name: 'Save book' }).first().click();

        await page.getByRole('heading', { name: 'Book saved' }).waitFor();
        const tags = (await admin.call<TagDto[]>('/tags')).body;

        expect(tags).toEqual([{ id: expect.any(String), name: 'Science-fiction', bookCount: 1 }]);
    });

    it('renames a tag on every linked book', async () => {
        const tag = await created<TagDto>('/tags', { name: 'Fantasy' });
        const piranesi = await book('Piranesi', { tags: [{ id: tag.id }] });
        const page = await signedIn('camille');

        await page.getByRole('link', { name: 'Tags' }).click();
        await page.getByRole('button', { name: 'Rename Fantasy' }).click();
        await page.getByLabel(/Tag name/).fill('High fantasy');

        await page.getByRole('button', { name: 'Save tag' }).click();

        await page.getByText('The tag is now “High fantasy”.').waitFor();
        expect((await admin.call<BookDto>('/books/' + piranesi.id)).body.tags).toEqual([
            { id: tag.id, name: 'High fantasy' },
        ]);
        await capture(page, 'tags');
    });

    it('deletes a tag after confirming its book count and keeps the books', async () => {
        const tag = await created<TagDto>('/tags', { name: 'Medieval' });
        const piranesi = await book('Piranesi', { tags: [{ id: tag.id }] });
        const page = await signedIn('camille');

        await page.getByRole('link', { name: 'Tags' }).click();
        await page.getByRole('button', { name: 'Delete Medieval' }).click();
        await page
            .getByText('This removes the tag from 1 book. The book itself will be kept.')
            .waitFor();

        await page.getByRole('dialog').getByRole('button', { name: 'Delete tag' }).click();

        await page.getByText('“Medieval” was deleted. Its books were kept.').waitFor();
        expect((await admin.call<BookDto>('/books/' + piranesi.id)).body.tags).toEqual([]);
    });

    it('keeps an unused tag once its last book is untagged on the book details', async () => {
        const tag = await created<TagDto>('/tags', { name: 'To explore' });
        const piranesi = await book('Piranesi', { tags: [{ id: tag.id }] });
        const page = await signedIn('camille');

        await page.goto('/books/' + piranesi.id);

        await page.getByRole('button', { name: 'Remove the tag To explore' }).click();

        await page.getByText('Saved', { exact: true }).waitFor();
        expect((await admin.call<TagDto[]>('/tags')).body).toEqual([
            { id: tag.id, name: 'To explore', bookCount: 0 },
        ]);
    });
});

describe('Book details organisation', () => {
    it('saves the chosen shelf at once, without a Save button', async () => {
        const oak = await bookcase('Oak bookcase', ['Shelf 1', 'Shelf 3']);
        const piranesi = await book('Piranesi');
        const page = await signedIn('camille');

        await page.goto('/books/' + piranesi.id);

        await page
            .getByLabel('Physical location')
            .selectOption({ label: 'Oak bookcase – Shelf 3' });

        await page.getByText('Saved', { exact: true }).waitFor();
        expect((await admin.call<BookDto>('/books/' + piranesi.id)).body.location?.shelfId).toBe(
            oak.shelves[1]!.id,
        );
        expect(await page.getByRole('button', { name: /^Save/ }).count()).toBe(0);
        await capture(page, 'book-details-organisation');
    });
});

describe('Advanced filters', () => {
    async function library() {
        const oak = await bookcase('Oak bookcase', ['Top']);
        const hall = await bookcase('Hall bookcase', ['Top']);
        const [fantasy, adventure, medieval] = await Promise.all(
            ['Fantasy', 'Adventure', 'Medieval'].map((name) => created<TagDto>('/tags', { name })),
        );
        const both = [{ id: fantasy!.id }, { id: adventure!.id }];
        const inOak = oak.shelves[0]!.id;

        await book('Match manga', { category: 'manga', shelfId: inOak, tags: both });
        await book('Match comics', { category: 'comics', shelfId: inOak, tags: both });
        await book('Medieval manga', {
            category: 'manga',
            shelfId: inOak,
            tags: [...both, { id: medieval!.id }],
        });
        await book('Novel', { category: 'books', shelfId: inOak, tags: both });
        await book('Hall manga', { category: 'manga', shelfId: hall.shelves[0]!.id, tags: both });
        await book('Wanted manga', {
            category: 'manga',
            ownership: 'not-owned',
            shelfId: inOak,
            tags: both,
        });
        await book('Only fantasy', {
            category: 'manga',
            shelfId: inOak,
            tags: [{ id: fantasy!.id }],
        });
    }

    it('combines fields with AND, choices with OR and tags as include all, exclude any', async () => {
        await library();
        const page = await signedIn('camille');

        await page.getByRole('button', { name: 'Advanced filters' }).click();
        await page.getByText('Any category').click();
        await page.getByRole('checkbox', { name: 'Manga' }).check();
        await page.getByRole('checkbox', { name: 'Comics' }).check();
        await page.getByRole('group', { name: 'Ownership' }).getByText('Any').click();
        await page.getByRole('checkbox', { name: 'Owned', exact: true }).check();
        await page.getByText('Any bookcase / shelf').click();
        await page.getByRole('checkbox', { name: 'Oak bookcase' }).check();

        for (const [tag, choice] of [
            ['Fantasy', 'Include'],
            ['Adventure', 'Include'],
            ['Medieval', 'Exclude'],
        ] as const) {
            await page
                .getByRole('radiogroup', { name: tag })
                .getByText(choice, { exact: true })
                .click();
        }

        await capture(page, 'advanced-filters');

        await page.getByRole('button', { name: 'Show results' }).click();

        await page.getByText('2 of 7 books').waitFor();
        const titles = await page.locator('.book-card__title').allTextContents();

        expect(titles.map((title) => title.replace(/ \d+$/, '')).sort()).toEqual([
            'Match comics',
            'Match manga',
        ]);
        await capture(page, 'my-books-filtered');
    });

    it('narrows the filtered books with the search text', async () => {
        await library();
        const page = await signedIn('camille');

        await page.goto('/books?category=manga&search=hall');

        await page.getByText('1 of 7 books').waitFor();

        expect(await page.locator('.book-card__title').allTextContents()).toEqual([
            expect.stringMatching(/^Hall manga/),
        ]);
    });

    it('finds books without location or collection through explicit choices', async () => {
        const oak = await bookcase('Oak bookcase', ['Top']);

        await book('Shelved', { shelfId: oak.shelves[0]!.id });
        await book('Loose');
        const page = await signedIn('camille');

        await page.goto('/books?location=none&collection=none');

        await page.getByText('1 of 2 books').waitFor();
        expect(
            await page
                .getByRole('button', { name: 'Remove the filter No physical location' })
                .count(),
        ).toBe(1);
        expect(await page.locator('.book-card__title').allTextContents()).toEqual([
            expect.stringMatching(/^Loose/),
        ]);
    });

    it('shows a collection only when one of its books matches every criterion', async () => {
        const fantasy = await created<TagDto>('/tags', { name: 'Fantasy' });

        await book('Batman', {
            authors: [{ name: 'Bob Kane' }],
            collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
        });
        await book('Batman', {
            authors: [{ name: 'Frank Miller' }],
            tags: [{ id: fantasy.id }],
            collection: { collection: { name: 'Batman' }, volumeFrom: 2, volumeTo: 2 },
        });
        await book('Dune', {
            authors: [{ name: 'Bob Kane' }],
            tags: [{ id: fantasy.id }],
            collection: { collection: { name: 'Dune' }, volumeFrom: 1, volumeTo: 1 },
        });
        await book('Dune', {
            ownership: 'not-owned',
            collection: { collection: { name: 'Dune' }, volumeFrom: 10, volumeTo: 10 },
        });
        await book('Dune', {
            collection: { collection: { name: 'Dune' }, volumeFrom: 2, volumeTo: 2 },
        });
        const authors = (await admin.call<{ id: string; name: string }[]>('/authors?search=kane'))
            .body;
        const page = await signedIn('camille');

        await page.goto('/collections?author=' + authors[0]!.id + '&tag=' + fantasy.id);

        await page.getByText('1 of 2 collections').waitFor();
        const rows = page.locator('.collection-card');

        expect(await rows.count()).toBe(1);
        expect(await rows.first().textContent()).toContain('Dune');
        expect(await rows.first().textContent()).toContain('2 / 10 volumes Owned');
    });

    it('gives a Guest no reading status filter', async () => {
        await book('Piranesi');
        const page = await signedIn('morgan');

        await page.getByRole('button', { name: 'Advanced filters' }).click();

        await page.getByRole('heading', { name: 'Advanced book filters' }).waitFor();
        expect(await page.getByText('Your reading status').count()).toBe(0);
        expect(await page.getByText('Ownership', { exact: true }).count()).toBe(1);
    });
});
