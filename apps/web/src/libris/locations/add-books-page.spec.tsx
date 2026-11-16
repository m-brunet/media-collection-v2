import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
    BookcaseDto,
    BookListItemDto,
    BookLocationDto,
} from '../../../../../packages/contracts/src/http';
import { AppearanceProvider } from '../../shared/appearance/appearance-context';
import { SessionProvider } from '../../shared/session/session-context';
import { bookItem } from '../../testing/book-fixtures.test-support';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { AddBooksPage } from './add-books-page';
import { AddBooksLayout } from './add-books-selection';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const bookcases: BookcaseDto[] = [
    {
        id: 'oak',
        name: 'Study · oak',
        bookCount: 64,
        shelves: [{ id: 's3', bookcaseId: 'oak', name: 'Shelf 3', bookCount: 64 }],
    },
    {
        id: 'hall',
        name: 'Hallway',
        bookCount: 1,
        shelves: [{ id: 'h1', bookcaseId: 'hall', name: 'Shelf 1', bookCount: 1 }],
    },
];
const here: BookLocationDto = {
    bookcaseId: 'oak',
    bookcaseName: 'Study · oak',
    shelfId: 's3',
    shelfName: 'Shelf 3',
};
const hallway: BookLocationDto = {
    bookcaseId: 'hall',
    bookcaseName: 'Hallway',
    shelfId: 'h1',
    shelfName: 'Shelf 1',
};
const dune = bookItem({ id: 'dune', title: 'Dune', authors: ['Frank Herbert'] });
const circe = bookItem({ id: 'circe', title: 'Circe', authors: ['Madeline Miller'] });
const mort = bookItem({ id: 'mort', title: 'Mort', location: here });
const eric = bookItem({ id: 'eric', title: 'Eric', location: hallway });
const lent = bookItem({
    id: 'lent',
    title: 'Babel',
    loan: { id: 'l1', receiverId: 'r1', receiverName: 'Hugo', lentAt: '2026-01-01T00:00:00.000Z' },
});

function page(items: BookListItemDto[], total = items.length) {
    return { status: 200, body: { total, items } };
}

function many(count: number, prefix = 'b'): BookListItemDto[] {
    return Array.from({ length: count }, (_, index) =>
        bookItem({ id: prefix + index, title: 'Book ' + prefix + index }),
    );
}

function list(search: string, location: 'none' | null, limit: number, offset = 0) {
    return (
        'GET /books?' +
        (location ? 'location=' + location + '&' : '') +
        new URLSearchParams({
            search,
            sort: 'title',
            direction: 'asc',
            ownership: 'owned',
            limit: String(limit),
            offset: String(offset),
        }).toString()
    );
}

function api(unplaced: BookListItemDto[] = [dune, circe]) {
    return new FakeApi()
        .signedIn(account({ role: 'owner' }))
        .on('GET /bookcases', () => ({ status: 200, body: bookcases }))
        .on(list('', 'none', 48), () => page(unplaced))
        .on(list('', 'none', 100), () => page(unplaced));
}

function Bookshelves() {
    const location = useLocation();

    return (
        <p>
            Bookshelves{location.search} {(location.state as { done?: string } | null)?.done}
        </p>
    );
}

function show(path = '/bookshelves/shelves/s3/add-books?location=none') {
    const router = createMemoryRouter(
        [
            {
                path: '/bookshelves/shelves/:shelfId/add-books',
                element: <AddBooksLayout />,
                children: [
                    { index: true, element: <AddBooksPage /> },
                    { path: 'filters', element: <p>Filters page</p> },
                ],
            },
            { path: '/bookshelves', element: <Bookshelves /> },
        ],
        { initialEntries: [path] },
    );

    render(
        <AppearanceProvider>
            <SessionProvider>
                <RouterProvider router={router} />
            </SessionProvider>
        </AppearanceProvider>,
    );

    return router;
}

function table() {
    return screen.findByRole('table', { name: 'Books to add to Shelf 3' });
}

function tick(title: string) {
    return userEvent.click(screen.getByRole('checkbox', { name: title }));
}

it('names the shelf, its bookcase and its current number of books', async () => {
    api();

    show();

    expect(await screen.findByRole('heading', { name: 'Add books to Shelf 3' })).toBeVisible();
    expect(screen.getByText('Study · oak · 64 books on this shelf today')).toBeInTheDocument();
});

it('opens on the Owned books without a physical location', async () => {
    const fake = api();

    show();
    await table();

    expect(fake.calls.map((call) => call.route)).toContain(list('', 'none', 48));
    expect(screen.getByTitle('This screen lists Owned books only.')).toBeInTheDocument();
    expect(
        screen.getByRole('button', { name: 'Remove the filter No physical location' }),
    ).toBeInTheDocument();
});

it('lists each book with its author, location and status', async () => {
    api([dune, lent]);

    show();

    const rows = within(await table()).getAllByRole('row');

    expect(within(rows[1]!).getByText('Frank Herbert')).toBeInTheDocument();
    expect(within(rows[1]!).getAllByText('None')).toHaveLength(2);
    expect(within(rows[2]!).getByText('Lent to Hugo')).toBeInTheDocument();
});

it('shows the shelved books once the location filter is removed', async () => {
    api().on(list('', null, 48), () => page([dune, eric, mort]));
    show();
    await table();

    await userEvent.click(
        screen.getByRole('button', { name: 'Remove the filter No physical location' }),
    );

    expect(await screen.findByText('Hallway – Shelf 1')).toBeInTheDocument();
    expect(screen.getByText('Already here')).toBeInTheDocument();
});

it('does not let a book already on the shelf be ticked', async () => {
    api().on(list('', null, 48), () => page([dune, mort]));

    show('/bookshelves/shelves/s3/add-books');
    await table();

    expect(screen.getByRole('checkbox', { name: 'Mort' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Dune' })).toBeEnabled();
});

it('disables the save while no book is chosen', async () => {
    api();

    show();
    await table();

    expect(screen.getByText('No book chosen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place books on Shelf 3' })).toBeDisabled();
});

it('says what will happen to the chosen books before saving', async () => {
    api().on(list('', null, 48), () => page([dune, circe, eric]));
    show('/bookshelves/shelves/s3/add-books');
    await table();

    await tick('Dune');
    await tick('Circe');
    await tick('Eric');

    expect(screen.getByText('3 books chosen')).toBeInTheDocument();
    expect(
        screen.getByText('2 placed on Shelf 3 · 1 moved from Hallway – Shelf 1'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place 3 books on Shelf 3' })).toBeEnabled();
});

it('says no book moves when every chosen book had no location', async () => {
    api();
    show();
    await table();

    await tick('Dune');

    expect(screen.getByText('1 book chosen')).toBeInTheDocument();
    expect(
        screen.getByText('1 placed on Shelf 3 · none moved from another shelf'),
    ).toBeInTheDocument();
});

it('keeps the selection while the search changes', async () => {
    api().on(list('circe', 'none', 48), () => page([circe]));
    show();
    await table();
    await tick('Dune');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search books' }), 'circe');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Circe' }));

    expect(screen.getByText('2 books chosen')).toBeInTheDocument();
});

it('selects every matching book that is not already on the shelf', async () => {
    api()
        .on(list('', null, 48), () => page([dune, circe, mort]))
        .on(list('', null, 100), () => page([dune, circe, mort]));
    show('/bookshelves/shelves/s3/add-books');
    await table();

    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));

    expect(await screen.findByText('2 books chosen')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Mort' })).not.toBeChecked();
});

it('refuses Select all above a hundred matching books, and says why', async () => {
    api().on(list('', 'none', 48), () => page(many(48), 214));

    show();
    await table();

    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled();
    expect(
        screen.getByText('Up to 100 books at once. Narrow the search to select them all.'),
    ).toBeInTheDocument();
});

it('refuses the hundred-and-first book, and says why', async () => {
    api(many(100))
        .on(list('', 'none', 48), () => page(many(48), 100))
        .on(list('dune', 'none', 48), () => page([dune]));
    show();
    await table();
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
    await screen.findByText('100 books chosen');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search books' }), 'dune');

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Dune' }));

    expect(screen.getByRole('checkbox', { name: 'Dune' })).not.toBeChecked();
    expect(screen.getByText('100 books chosen')).toBeInTheDocument();
    expect(
        screen.getByText('Up to 100 books at once. Narrow the search to select them all.'),
    ).toBeInTheDocument();
});

it('clears the selection', async () => {
    api();
    show();
    await table();
    await tick('Dune');

    await userEvent.click(screen.getByRole('button', { name: 'Clear the selection' }));

    expect(screen.getByText('No book chosen')).toBeInTheDocument();
});

it('loads the following books as the table scrolls', async () => {
    const fake = api().on(list('', 'none', 48), () => page(many(48), 60));

    fake.on(list('', 'none', 48, 48), () => page(many(12, 'n'), 60));
    show();

    fireEvent.scroll((await table()).parentElement!);

    expect(await screen.findByRole('checkbox', { name: 'Book n11' })).toBeInTheDocument();
});

it('places the chosen books and returns to the shelf with a summary', async () => {
    const fake = api()
        .on(list('', null, 48), () => page([dune, eric]))
        .on('POST /books/shelf-placement', () => ({
            status: 200,
            body: {
                shelf: here,
                placed: [{ id: 'dune', title: 'Dune' }],
                moved: [{ id: 'eric', title: 'Eric', from: hallway }],
                unchanged: [],
            },
        }));

    show('/bookshelves/shelves/s3/add-books');
    await table();
    await tick('Dune');
    await tick('Eric');

    await userEvent.click(screen.getByRole('button', { name: 'Place 2 books on Shelf 3' }));

    expect(
        await screen.findByText(
            /Bookshelves\?bookcase=oak&shelf=s3 2 books are now on Shelf 3: 1 placed on Shelf 3 · 1 moved from Hallway – Shelf 1\./,
        ),
    ).toBeInTheDocument();
    expect(fake.calls.find((call) => call.route === 'POST /books/shelf-placement')?.body).toEqual({
        shelfId: 's3',
        bookIds: ['dune', 'eric'],
    });
});

it('shows a refused save and keeps the screen and the selection', async () => {
    api().on('POST /books/shelf-placement', () => ({
        status: 404,
        body: { code: 'not_found', message: 'That book does not exist.' },
    }));
    show();
    await table();
    await tick('Dune');

    await userEvent.click(screen.getByRole('button', { name: 'Place 1 book on Shelf 3' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Dune' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Place 1 book on Shelf 3' })).toBeEnabled();
});

it('returns to the shelf on Cancel, without saving', async () => {
    const fake = api();

    show();
    await table();
    await tick('Dune');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText(/Bookshelves\?bookcase=oak&shelf=s3/)).toBeInTheDocument();
    expect(fake.calls.map((call) => call.route)).not.toContain('POST /books/shelf-placement');
});

it('opens the advanced filters of this screen with the current choices', async () => {
    api();
    const router = show();

    await table();

    await userEvent.click(screen.getByRole('button', { name: 'Advanced filters' }));

    expect(await screen.findByText('Filters page')).toBeInTheDocument();
    expect(router.state.location.pathname + router.state.location.search).toBe(
        '/bookshelves/shelves/s3/add-books/filters?location=none',
    );
});

it('says when no book matches', async () => {
    api([]);

    show();

    expect(await screen.findByText('No book matches.')).toBeInTheDocument();
});

it('says when the shelf no longer exists', async () => {
    api();

    show('/bookshelves/shelves/gone/add-books?location=none');

    expect(await screen.findByText('This shelf no longer exists.')).toBeInTheDocument();
});
