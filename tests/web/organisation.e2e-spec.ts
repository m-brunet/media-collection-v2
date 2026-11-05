import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import type {
    BookcaseDto,
    BookDto,
    NewBookDto,
    ShelfDto,
    TagDto,
} from '../../packages/contracts/src/http.js';
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

// Arranges data through the API, failing loudly when the server refuses it.
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

// A saved book without ISBN, so several can share a title pattern.
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

// Renames a bookcase, shelf or tag through the API, to arrange a scenario.
async function renamed(path: string, name: string) {
    const response = await admin.call(path, 'PATCH', { name });

    if (response.status !== 200) {
        throw new Error('Renaming failed on ' + path + ': ' + response.text);
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

async function openBookshelves(page: Page) {
    await page.getByRole('link', { name: 'Bookshelves' }).click();
    await page.getByRole('heading', { name: 'Bookshelves' }).waitFor();
}

function tree(page: Page) {
    return page.getByRole('navigation', { name: 'Bookcases and shelves' });
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

        await tree(page).getByRole('button', { name: 'Top · 0 books' }).waitFor();
        expect(await page.getByText('1 bookcase · 1 shelf').count()).toBe(1);
        await capture(page, 'bookshelves');
    });

    it('renames a bookcase', async () => {
        await bookcase('Oak bookcase', ['Shelf 3']);
        const page = await signedIn('camille');

        await openBookshelves(page);
        await page.getByRole('button', { name: 'Rename bookcase' }).click();
        await page.getByLabel(/Bookcase name/).fill('Walnut bookcase');

        await page.getByRole('button', { name: 'Save name' }).click();

        await page.getByText('The bookcase is now “Walnut bookcase”.').waitFor();
        expect(await tree(page).getByText('Walnut bookcase').count()).toBe(1);
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
        const study = tree(page).locator('section', { hasText: 'Study bookcase' });

        expect(await study.getByRole('button', { name: 'Middle · 1 book' }).count()).toBe(1);
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
    // Manga or Comics, Owned, kept in the Oak bookcase, with Fantasy and Adventure but not Medieval.
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
        await page.getByText('Owned or Not Owned').click();
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

        // Batman: one book by the author, another with the tag; none has both.
        await book('Batman', {
            authors: [{ name: 'Bob Kane' }],
            collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
        });
        await book('Batman', {
            authors: [{ name: 'Frank Miller' }],
            tags: [{ id: fantasy.id }],
            collection: { collection: { name: 'Batman' }, volumeFrom: 2, volumeTo: 2 },
        });
        // Dune: one book with both, among ten expected volumes of which two are Owned.
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
        const rows = page.locator('.collection-row');

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
