import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BookBatchDto, BookListItemDto } from '../../../../../packages/contracts/src/http';
import { bookItem } from '../../testing/book-fixtures.test-support';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { MyBooksPage } from './my-books-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const piranesi = bookItem();
const dune = bookItem({ id: 'b2', title: 'Dune', ownership: 'not-owned' });
const emma = bookItem({ id: 'b3', title: 'Emma' });

function show() {
    return renderRoute('/books', {
        '/books': <MyBooksPage />,
        '/books/filters': <p>Filter page</p>,
    });
}

function plan(saved: boolean): BookBatchDto {
    return {
        collection: null,
        saved,
        books: [
            {
                id: 'b1',
                title: 'Piranesi',
                before: { publisher: null },
                after: { publisher: 'Glénat' },
            },
        ],
        skipped: [{ id: 'b2', title: 'Dune', reason: 'not-in-collection' }],
    };
}

function libraryApi(items: BookListItemDto[] = [piranesi, dune], total = items.length) {
    return new FakeApi()
        .signedIn(account())
        .on('GET /books', () => ({ status: 200, body: { total, items } }))
        .on('POST /books/batch-edit', (body) => ({
            status: 200,
            body: plan(!(body as { preview: boolean }).preview),
        }));
}

async function startBatch() {
    await userEvent.click(await screen.findByRole('button', { name: 'Edit books' }));
}

function card(title: RegExp) {
    return screen.getByRole('button', { name: title });
}

async function review() {
    await startBatch();
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit 2 books' }));
    const panel = screen.getByRole('dialog', { name: 'Edit 2 books' });

    await userEvent.click(within(panel).getByRole('button', { name: 'Publisher' }));
    await userEvent.type(
        within(panel).getByRole('combobox', { name: 'Publisher: new value' }),
        'Glénat',
    );
    await userEvent.click(within(panel).getByRole('button', { name: 'Review changes' }));

    return screen.findByRole('dialog', { name: 'Review changes' });
}

it('offers a Guest no Edit books mode', async () => {
    new FakeApi()
        .signedIn(account({ role: 'guest' }))
        .on('GET /books', () => ({ status: 200, body: { total: 1, items: [piranesi] } }));

    show();

    await screen.findByRole('link', { name: /Piranesi/ });
    expect(screen.queryByRole('button', { name: 'Edit books' })).not.toBeInTheDocument();
});

it('offers no Edit books mode for an empty library', async () => {
    new FakeApi().signedIn(account());

    show();

    await screen.findByText(/Your shared library is empty/);
    expect(screen.queryByRole('button', { name: 'Edit books' })).not.toBeInTheDocument();
});

it('turns the book cards into a selection', async () => {
    libraryApi();
    show();

    await startBatch();
    await userEvent.click(card(/Piranesi/));

    expect(card(/Piranesi/)).toHaveAttribute('aria-pressed', 'true');
    expect(card(/Dune/)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('1 of 2 books chosen')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Piranesi/ })).not.toBeInTheDocument();
});

it('hides the search, filters, sort and Add a book while choosing', async () => {
    libraryApi();
    show();

    await startBatch();

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Advanced filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Sort books' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a book' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit books' })).not.toBeInTheDocument();
});

it('brings the search and filters back on Cancel', async () => {
    libraryApi();
    show();
    await startBatch();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advanced filters' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Piranesi/ })).toBeInTheDocument();
});

it('selects every displayed book', async () => {
    libraryApi([piranesi, dune], 3);
    show();
    await startBatch();

    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));

    expect(screen.getByText('2 of 2 books chosen')).toBeInTheDocument();
});

it('selects the displayed Owned books', async () => {
    libraryApi();
    show();
    await startBatch();

    await userEvent.click(screen.getByRole('button', { name: 'Select owned' }));

    expect(card(/Piranesi/)).toHaveAttribute('aria-pressed', 'true');
    expect(card(/Dune/)).toHaveAttribute('aria-pressed', 'false');
});

it('loads more books while choosing without choosing them', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /books?search=&sort=title&direction=asc&limit=48&offset=0', () => ({
            status: 200,
            body: { total: 3, items: [piranesi, dune] },
        }))
        .on('GET /books?search=&sort=title&direction=asc&limit=48&offset=2', () => ({
            status: 200,
            body: { total: 3, items: [emma] },
        }));
    show();
    await startBatch();
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('button', { name: /Emma/ })).toHaveAttribute(
        'aria-pressed',
        'false',
    );
    expect(screen.getByText('2 of 3 books chosen')).toBeInTheDocument();
});

it('chooses at most 1,000 books and says so', async () => {
    const many = Array.from({ length: 1001 }, (_, index) =>
        bookItem({ id: 'b' + index, title: 'Book ' + index }),
    );

    libraryApi(many);
    show();
    await startBatch();

    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));

    expect(screen.getByText('1000 of 1001 books chosen')).toBeInTheDocument();
    expect(
        screen.getByText('A batch takes at most 1,000 books, so only the first 1,000 are chosen.'),
    ).toBeInTheDocument();
});

it('sends the chosen books without a collection', async () => {
    const api = libraryApi();

    show();
    await review();

    expect(api.calls.find((call) => call.route === 'POST /books/batch-edit')?.body).toEqual({
        bookIds: ['b1', 'b2'],
        preview: true,
        changes: { publisher: 'Glénat' },
    });
});

it('sends a publication date from the Library', async () => {
    const api = libraryApi();

    show();
    await startBatch();
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit 2 books' }));
    const panel = screen.getByRole('dialog', { name: 'Edit 2 books' });

    await userEvent.click(within(panel).getByRole('button', { name: 'Publication date' }));
    await userEvent.type(within(panel).getByRole('textbox', { name: 'Publication year' }), '2019');

    await userEvent.click(within(panel).getByRole('button', { name: 'Review changes' }));

    expect(api.calls.find((call) => call.route === 'POST /books/batch-edit')?.body).toEqual({
        bookIds: ['b1', 'b2'],
        preview: true,
        changes: { publication: { year: 2019, month: null } },
    });
});

it('names a book in no collection left out of the generated titles', async () => {
    libraryApi();
    show();

    const panel = await review();

    expect(
        within(within(panel).getByRole('list', { name: 'Left out' })).getByText(
            /Not in a collection/,
        ),
    ).toBeInTheDocument();
});

it('marks the saved and left out books after saving', async () => {
    libraryApi();
    show();
    const panel = await review();

    await userEvent.click(within(panel).getByRole('button', { name: 'Save 1 book' }));

    expect(
        await screen.findByText('1 book updated. Dune was left out (Not in a collection).'),
    ).toBeInTheDocument();
    expect(screen.getByText('Done goes back to the book list.')).toBeInTheDocument();
});

it('reloads the list with its search and filters after Done', async () => {
    const api = libraryApi();

    show();
    const panel = await review();

    await userEvent.click(within(panel).getByRole('button', { name: 'Save 1 book' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Done' }));

    expect(await screen.findByRole('link', { name: /Piranesi/ })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(api.calls.filter((call) => call.route.startsWith('GET /books?search='))).toHaveLength(2);
});
