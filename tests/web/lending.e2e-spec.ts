import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import type { BookDto, LendingDto, NewBookDto } from '../../packages/contracts/src/http.js';
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

async function book(title: string, overrides: Partial<NewBookDto> = {}): Promise<BookDto> {
    return created<BookDto>(
        '/books',
        BookInputFixture.of({
            title,
            isbn: null,
            noIsbn: true,
            confirmDistinct: true,
            ...overrides,
        }),
    );
}

async function lent(receiverName: string, ...books: BookDto[]): Promise<LendingDto> {
    return created<LendingDto>('/loans', {
        receiver: { name: receiverName },
        bookIds: books.map((value) => value.id),
    });
}

async function signedIn(username: string): Promise<Page> {
    const page = await browser.page(base, { viewport: viewports.referenceDesktop });

    await page.goto('/');
    await page.getByLabel(/^Username/).fill(username);
    await page.getByLabel(/^Password/).fill(username + '-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    await page.getByRole('link', { name: 'Library', exact: true }).click();
    await page.getByRole('heading', { name: 'Library', exact: true }).waitFor();

    return page;
}

async function openLoans(page: Page) {
    await page.getByRole('link', { name: 'Loans' }).click();
    await page.getByRole('heading', { name: 'Lent books' }).waitFor();
}

describe('Lending', () => {
    it('lends a book with another one added, and lists both under the receiver', async () => {
        const piranesi = await book('Piranesi');

        await book('Dune');
        const page = await signedIn('camille');

        await page.goto('/books/' + piranesi.id);
        await page.getByRole('button', { name: 'Lend', exact: true }).click();
        await page.getByRole('heading', { name: 'Lend books' }).waitFor();
        await page.getByLabel(/^Receiver name/).fill('Sam Taylor');
        await page.getByLabel('Find a book').fill('dune');
        await page.getByRole('button', { name: 'Add Dune to the selection' }).click();
        await capture(page, 'lend-books');

        await page.getByRole('button', { name: 'Lend 2 books' }).click();

        await page.getByText('Lent 2 books to Sam Taylor.').waitFor();
        const sam = page.getByRole('region', { name: 'Sam Taylor' });

        await sam.waitFor();

        expect(await sam.getByText('2 books currently lent').count()).toBe(1);
        expect(await sam.getByRole('link', { name: 'Piranesi' }).count()).toBe(1);
        expect(await sam.getByRole('link', { name: 'Dune' }).count()).toBe(1);
        expect(await sam.getByText(/^Lent \d{1,2} \w+ \d{4}$/).count()).toBe(2);
        await capture(page, 'lent-books');
    });

    it('reuses an existing receiver chosen after a similar-name question', async () => {
        await lent('Sam Taylor', await book('Dune'));
        const piranesi = await book('Piranesi');
        const page = await signedIn('camille');

        await page.goto('/loans/lend?book=' + piranesi.id);
        await page.getByLabel(/^Receiver name/).fill('Sam Tayler');
        await page.getByRole('button', { name: 'Lend 1 book' }).click();
        await page.getByText('Did you mean Sam Taylor?').waitFor();
        await page.getByRole('button', { name: 'Use Sam Taylor' }).click();

        await page.getByRole('button', { name: 'Lend 1 book' }).click();

        await page.getByText('Lent 1 book to Sam Taylor.').waitFor();
        await page.getByRole('region', { name: 'Sam Taylor' }).waitFor();
        expect(await page.getByRole('region').count()).toBe(1);
        expect(
            await page
                .getByRole('region', { name: 'Sam Taylor' })
                .getByText('2 books currently lent')
                .count(),
        ).toBe(1);
    });

    it('keeps the draft when a selected book was lent meanwhile', async () => {
        const piranesi = await book('Piranesi');
        const page = await signedIn('camille');

        await page.goto('/loans/lend?book=' + piranesi.id);
        await page.getByLabel(/^Receiver name/).fill('Sam Taylor');
        await page.getByRole('button', { name: 'Lend 1 book' }).waitFor();
        await lent('Morgan', piranesi);

        await page.getByRole('button', { name: 'Lend 1 book' }).click();

        await page.getByText(/Already lent: Piranesi/).waitFor();
        expect(await page.getByText('Already lent to Morgan').count()).toBe(1);
        expect(await page.getByLabel(/^Receiver name/).inputValue()).toBe('Sam Taylor');
    });
});

describe('Returns', () => {
    it('records a partial return across lending occasions, leaving the other book lent', async () => {
        const piranesi = await book('Piranesi');
        const dune = await book('Dune');
        const overstory = await book('The Overstory');

        await lent('Sam Taylor', piranesi, dune);
        await lent('Sam Taylor', overstory);
        const page = await signedIn('camille');

        await page.goto('/books/' + dune.id);
        await page.getByRole('button', { name: 'Record return' }).click();
        await page.getByRole('heading', { name: 'Record returns' }).waitFor();
        await page.getByRole('checkbox', { name: /^The Overstory/ }).check();
        await capture(page, 'record-returns');

        await page.getByRole('button', { name: 'Record 2 returns' }).click();

        await page.getByText('Recorded the return of 2 books from Sam Taylor.').waitFor();
        const sam = page.getByRole('region', { name: 'Sam Taylor' });

        await sam.waitFor();

        expect(await sam.getByText('1 book currently lent').count()).toBe(1);
        expect(await sam.getByRole('link', { name: 'Piranesi' }).count()).toBe(1);
    });

    it('removes the Lent mark from a returned book, keeping it Owned', async () => {
        const piranesi = await book('Piranesi');
        const lending = await lent('Sam Taylor', piranesi);

        await admin.call('/loans/returns', 'POST', { loanIds: [lending.loans[0]!.loanId] });
        const page = await signedIn('camille');

        await page.goto('/books');

        const card = page.getByRole('link', { name: /Piranesi/ });

        await card.waitFor();
        expect(await card.textContent()).toContain('Owned · Not read');
        expect(await card.textContent()).not.toContain('Lent');
    });
});

describe('Lent books in the library', () => {
    it('marks a lent book in the Library', async () => {
        await lent('Sam Taylor', await book('Piranesi'));
        const page = await signedIn('camille');

        await page.goto('/books');

        const card = page.getByRole('link', { name: /Piranesi/ });

        await card.waitFor();
        expect(await card.textContent()).toContain('Owned · Not read · Lent');
    });

    it('refuses to delete a lent book and explains why', async () => {
        const piranesi = await book('Piranesi');

        await lent('Sam Taylor', piranesi);
        const page = await signedIn('camille');

        await page.goto('/books/' + piranesi.id);
        await page.getByText('Lent to Sam Taylor').waitFor();
        await page.getByRole('button', { name: 'Delete book' }).click();

        await page.getByRole('dialog').getByRole('button', { name: 'Delete book' }).click();

        await page
            .getByRole('dialog')
            .getByText('Return this book before deleting it or changing it to Not Owned.')
            .waitFor();
        expect(page.url()).toContain('/books/' + piranesi.id);
    });

    it('shows a Guest the loans without return actions', async () => {
        await lent('Sam Taylor', await book('Piranesi'));
        const page = await signedIn('morgan');

        await openLoans(page);

        await page.getByRole('region', { name: 'Sam Taylor' }).waitFor();
        expect(await page.getByRole('button', { name: /Record the return/ }).count()).toBe(0);
    });

    it('shows a Guest who has a lent book without lending or return actions', async () => {
        const piranesi = await book('Piranesi');

        await lent('Sam Taylor', piranesi);
        const page = await signedIn('morgan');

        await page.goto('/books/' + piranesi.id);

        await page.getByText('Lent to Sam Taylor').waitFor();
        expect(await page.getByRole('button', { name: 'Record return' }).count()).toBe(0);
        expect(await page.getByRole('button', { name: 'Lend', exact: true }).count()).toBe(0);
    });
});
