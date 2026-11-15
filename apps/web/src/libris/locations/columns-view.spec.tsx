import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { bookItem } from '../../testing/book-fixtures.test-support';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { BookshelvesPage } from './bookshelves-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
});

const bookcases: BookcaseDto[] = [
    {
        id: 'oak',
        name: 'Oak bookcase',
        bookCount: 3,
        shelves: [
            { id: 's1', bookcaseId: 'oak', name: 'Shelf 1', bookCount: 0 },
            { id: 's3', bookcaseId: 'oak', name: 'Shelf 3', bookCount: 3 },
        ],
    },
    {
        id: 'study',
        name: 'Study bookcase',
        bookCount: 1,
        shelves: [{ id: 'top', bookcaseId: 'study', name: 'Top', bookCount: 1 }],
    },
    { id: 'hall', name: 'Hall', bookCount: 0, shelves: [] },
];
const shelf3 = [
    bookItem({
        id: 'wolf',
        title: 'Wolf Hall',
        authors: ['Hilary Mantel'],
        collection: { name: 'Thomas Cromwell', volumeFrom: 1, volumeTo: 1 },
        read: true,
    }),
    bookItem({ id: 'solaris', title: 'Solaris', authors: ['Stanisław Lem'], read: false }),
    bookItem({
        id: 'snow',
        title: 'Snow Crash',
        authors: ['Neal Stephenson'],
        loan: {
            id: 'l1',
            receiverId: 'camille',
            receiverName: 'Camille',
            lentAt: '2026-11-01T10:00:00.000Z',
        },
    }),
];

function route(shelf: string) {
    return (
        'GET /books?' +
        new URLSearchParams({
            location: 'shelf:' + shelf,
            sort: 'shelf',
            offset: '0',
            limit: '25',
        }).toString()
    );
}

function api(role: 'owner' | 'guest' = 'owner') {
    return new FakeApi()
        .signedIn(account({ role }))
        .on('GET /bookcases', () => ({ status: 200, body: bookcases }))
        .on(route('s1'), () => ({ status: 200, body: { total: 0, items: [] } }))
        .on(route('s3'), () => ({ status: 200, body: { total: 3, items: shelf3 } }))
        .on(route('top'), () => ({
            status: 200,
            body: { total: 1, items: [bookItem({ id: 'dune', title: 'Dune' })] },
        }));
}

function show(path = '/bookshelves?view=columns&shelf=s3') {
    return renderRoute(path, {
        '/bookshelves': <BookshelvesPage />,
        '/books/:id': <p>Book page</p>,
    });
}

function table() {
    return screen.findByRole('table', { name: 'Books on Shelf 3' });
}

function bookcaseList() {
    return screen.getByRole('listbox', { name: 'Bookcases' });
}

it('lists the bookcases with their book counts and selects the open one', async () => {
    api();
    show();

    await table();

    expect(
        within(bookcaseList())
            .getAllByRole('option')
            .map((option) => [option.textContent, option.getAttribute('aria-selected')]),
    ).toEqual([
        ['Oak bookcase3', 'true'],
        ['Study bookcase1', 'false'],
        ['Hall0', 'false'],
    ]);
});

it('lists the shelves of the open bookcase with their book counts', async () => {
    api();
    show();

    await table();

    expect(
        within(screen.getByRole('listbox', { name: 'Shelves of Oak bookcase' }))
            .getAllByRole('option')
            .map((option) => option.textContent),
    ).toEqual(['Shelf 10', 'Shelf 33']);
});

it('opens another bookcase from its column and writes it to the address', async () => {
    api();
    const router = show();

    await table();

    await userEvent.click(within(bookcaseList()).getByRole('option', { name: /^Study bookcase/ }));

    expect([
        await screen.findByRole('table', { name: 'Books on Top' }),
        router.state.location.search,
    ]).toEqual([expect.anything(), '?view=columns&bookcase=study']);
});

it('shows the title, author, collection and status of each book', async () => {
    api();
    show();

    const books = await table();

    expect(
        within(books)
            .getAllByRole('row')
            .slice(1)
            .map((row) =>
                within(row)
                    .getAllByRole('cell')
                    .map((cell) =>
                        [...cell.childNodes]
                            .filter((node) => node.nodeName !== 'BUTTON')
                            .map((node) => node.textContent)
                            .join(''),
                    ),
            ),
    ).toEqual([
        ['Wolf Hall', 'Hilary Mantel', 'Thomas Cromwell · 1', 'Owned · Read'],
        ['Solaris', 'Stanisław Lem', 'None', 'Owned'],
        ['Snow Crash', 'Neal Stephenson', 'None', 'Lent to Camille'],
    ]);
});

it('tells which books are shown out of the shelf', async () => {
    api();
    show();

    await table();

    expect(screen.getByText('1–3 of 3')).toBeInTheDocument();
});

it('moves the selection to the next bookcase with the Down arrow', async () => {
    api();
    const router = show();

    await table();
    within(bookcaseList())
        .getByRole('option', { name: /^Oak bookcase/ })
        .focus();

    await userEvent.keyboard('{ArrowDown}');

    expect([
        await screen.findByRole('table', { name: 'Books on Top' }),
        router.state.location.search,
    ]).toEqual([expect.anything(), '?view=columns&bookcase=study']);
});

it('goes from the shelves to the books with the Right arrow, then opens a book with Enter', async () => {
    api();
    show();
    await table();
    screen.getByRole('option', { name: /^Shelf 3/ }).focus();
    await userEvent.keyboard('{ArrowRight}{ArrowDown}');

    await userEvent.keyboard('{Enter}');

    expect(await screen.findByText('Book page')).toBeInTheDocument();
});

it('moves a book with M, then drops it from the table and reloads the counts', async () => {
    const calls = api().on('PATCH /books/solaris/organisation', () => ({ status: 200, body: {} }));

    show();
    const books = await table();

    within(books)
        .getByRole('row', { name: /^Solaris/ })
        .focus();
    await userEvent.keyboard('m');
    const dialog = screen.getByRole('dialog', { name: 'Move “Solaris”' });

    await userEvent.selectOptions(within(dialog).getByLabelText(/^Shelf/), 'Shelf 1');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Move book' }));

    expect([
        await screen.findByText('“Solaris” is now on Oak bookcase / Shelf 1.'),
        within(books).queryByRole('row', { name: /^Solaris/ }),
        calls.calls.filter((call) => call.route === 'GET /bookcases').length,
    ]).toEqual([expect.anything(), null, 2]);
});

it('opens the move dialog from the Move button of a row', async () => {
    api();
    show();
    const books = await table();

    await userEvent.click(within(books).getByRole('button', { name: 'Move Wolf Hall' }));

    expect(screen.getByRole('dialog', { name: 'Move “Wolf Hall”' })).toBeInTheDocument();
});

it('says when the selected shelf has no book', async () => {
    api();

    show('/bookshelves?view=columns&shelf=s1');

    expect(await screen.findByText('No book is on this shelf yet.')).toBeInTheDocument();
});

it('invites to add a shelf to a bookcase without shelves', async () => {
    api();

    show('/bookshelves?view=columns&bookcase=hall');

    expect(
        await screen.findByText('This bookcase has no shelf yet. Add one to assign books to it.'),
    ).toBeInTheDocument();
});

it('shows a Guest the books without managing or moving them', async () => {
    api('guest');
    show();
    const books = await table();

    within(books)
        .getByRole('row', { name: /^Solaris/ })
        .focus();

    await userEvent.keyboard('m');

    expect([
        screen.queryByRole('dialog'),
        within(books).queryByRole('button', { name: /^Move/ }),
        screen.queryByRole('button', { name: 'Add shelf' }),
        screen.queryByRole('button', { name: 'Oak bookcase actions' }),
    ]).toEqual([null, null, null, null]);
});

it('switches to the Ribbons keeping the bookcase and the shelf', async () => {
    api();
    const router = show('/bookshelves?view=columns&bookcase=oak&shelf=s3');

    await table();

    await userEvent.click(screen.getByRole('radio', { name: 'Ribbons' }));

    expect(router.state.location.search).toBe('?view=ribbons&bookcase=oak&shelf=s3');
});
