import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BookcaseDto, BookListItemDto } from '../../../../../packages/contracts/src/http';
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
        bookCount: 30,
        shelves: [
            { id: 's1', bookcaseId: 'oak', name: 'Shelf 1', bookCount: 0 },
            { id: 's3', bookcaseId: 'oak', name: 'Shelf 3', bookCount: 30 },
        ],
    },
    {
        id: 'study',
        name: 'Study bookcase',
        bookCount: 2,
        shelves: [{ id: 'top', bookcaseId: 'study', name: 'Top', bookCount: 2 }],
    },
    { id: 'hall', name: 'Hall', bookCount: 0, shelves: [] },
];

function books(from: number, count: number): BookListItemDto[] {
    return Array.from({ length: count }, (_, index) =>
        bookItem({
            id: 'b' + (from + index),
            title: 'Book ' + (from + index),
            authors: ['Author ' + (from + index)],
        }),
    );
}

function route(shelf: string, offset: number, limit = 24) {
    return (
        'GET /books?' +
        new URLSearchParams({
            location: 'shelf:' + shelf,
            sort: 'shelf',
            offset: String(offset),
            limit: String(limit),
        }).toString()
    );
}

function api(role: 'owner' | 'guest' = 'owner') {
    return new FakeApi()
        .signedIn(account({ role }))
        .on('GET /bookcases', () => ({ status: 200, body: bookcases }))
        .on(route('s1', 0), () => ({ status: 200, body: { total: 0, items: [] } }))
        .on(route('s3', 0), () => ({ status: 200, body: { total: 30, items: books(0, 24) } }))
        .on(route('s3', 24), () => ({ status: 200, body: { total: 30, items: books(24, 6) } }))
        .on(route('top', 0), () => ({ status: 200, body: { total: 2, items: books(100, 2) } }));
}

function show(path = '/bookshelves?view=ribbons') {
    return renderRoute(path, {
        '/bookshelves': <BookshelvesPage />,
        '/books': <p>My books</p>,
    });
}

function tabs() {
    return screen.getByRole('tablist', { name: 'Bookcases' });
}

function shelf3() {
    return screen.findByRole('list', { name: 'Books on Shelf 3' });
}

it('shows every bookcase as a tab with its counts and selects the open one', async () => {
    api();
    show();

    await shelf3();

    expect(
        within(tabs())
            .getAllByRole('tab')
            .map((tab) => [tab.textContent, tab.getAttribute('aria-selected')]),
    ).toEqual([
        ['Oak bookcase2 shelves · 30 books', 'true'],
        ['Study bookcase1 shelf · 2 books', 'false'],
        ['Hall0 shelves · 0 books', 'false'],
    ]);
});

it('opens the chosen bookcase and keeps the shelf of the address', async () => {
    api();
    const router = show('/bookshelves?view=ribbons&shelf=s3');

    await shelf3();

    await userEvent.click(within(tabs()).getByRole('tab', { name: /^Study bookcase/ }));

    expect([
        await screen.findByRole('list', { name: 'Books on Top' }),
        router.state.location.search,
    ]).toEqual([expect.anything(), '?view=ribbons&bookcase=study&shelf=s3']);
});

it('moves to the next bookcase with the Right arrow', async () => {
    api();
    show();
    await shelf3();
    within(tabs())
        .getByRole('tab', { name: /^Oak bookcase/ })
        .focus();

    await userEvent.keyboard('{ArrowRight}');

    expect(
        await screen.findByRole('heading', { level: 2, name: 'Study bookcase' }),
    ).toBeInTheDocument();
});

it('names the open bookcase and tells its shelves go top to bottom', async () => {
    api();
    show();

    await shelf3();

    expect(screen.getByText('2 shelves, top to bottom')).toBeInTheDocument();
});

it('shows the first covers of a shelf in shelf order, each linked to its book', async () => {
    const calls = api();

    show();

    const list = await shelf3();

    expect([
        within(list)
            .getAllByRole('link')
            .slice(0, 2)
            .map((link) => [link.getAttribute('aria-label'), link.getAttribute('href')]),
        calls.calls.map((call) => call.route),
    ]).toEqual([
        [
            ['Book 0 · Author 0', '/books/b0'],
            ['Book 1 · Author 1', '/books/b1'],
        ],
        expect.arrayContaining([route('s3', 0)]),
    ]);
});

it('ends the strip with a tile counting the books that do not fit', async () => {
    api();
    show();

    const list = await shelf3();

    expect([
        within(list).getAllByRole('link').length,
        within(list).getByRole('button', {
            name: '17 more books on Shelf 3, show the next ones',
        }).textContent,
    ]).toEqual([13, '+17']);
});

it('shows every cover of a shelf that fits, with no tile', async () => {
    api();
    show('/bookshelves?view=ribbons&bookcase=study');

    const list = await screen.findByRole('list', { name: 'Books on Top' });

    expect([within(list).getAllByRole('link').length, within(list).queryByRole('button')]).toEqual([
        2,
        null,
    ]);
});

it('loads and shows the next covers with the arrow', async () => {
    const calls = api();

    show();
    await shelf3();

    await userEvent.click(screen.getByRole('button', { name: 'Next books of Shelf 3' }));

    expect([
        await within(await shelf3()).findByRole('link', { name: 'Book 13 · Author 13' }),
        calls.calls.map((call) => call.route),
    ]).toEqual([expect.anything(), expect.arrayContaining([route('s3', 24)])]);
});

it('moves back along the shelf once the strip has moved', async () => {
    api();
    show();
    await shelf3();
    await userEvent.click(
        screen.getByRole('button', { name: '17 more books on Shelf 3, show the next ones' }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Previous books of Shelf 3' }));

    expect(
        await within(await shelf3()).findByRole('link', { name: 'Book 0 · Author 0' }),
    ).toBeInTheDocument();
});

it('shows no back arrow before the strip has moved', async () => {
    api();
    show();

    await shelf3();

    expect(
        screen.queryByRole('button', { name: 'Previous books of Shelf 3' }),
    ).not.toBeInTheDocument();
});

it('shows the title, author and status of the pointed cover', async () => {
    api();
    show();
    const list = await shelf3();

    await userEvent.hover(within(list).getByRole('link', { name: 'Book 0 · Author 0' }));

    expect(within(list).getByText('Author 0 · Owned · Not read')).toBeInTheDocument();
});

it('marks a lent book', async () => {
    api().on(route('top', 0), () => ({
        status: 200,
        body: {
            total: 1,
            items: [
                bookItem({
                    id: 'lent',
                    loan: {
                        id: 'l1',
                        receiverId: 'camille',
                        receiverName: 'Camille',
                        lentAt: '2026-11-01T10:00:00.000Z',
                    },
                }),
            ],
        },
    }));
    show('/bookshelves?view=ribbons&bookcase=study');

    const list = await screen.findByRole('list', { name: 'Books on Top' });

    expect(within(list).getByText('Lent')).toBeInTheDocument();
});

it('links the shelf name to My books filtered on the shelf', async () => {
    api();
    show();
    await shelf3();

    await userEvent.click(screen.getByRole('link', { name: 'Shelf 3' }));

    expect(await screen.findByText('My books')).toBeInTheDocument();
});

it('opens the shelf actions from its menu', async () => {
    api();
    show();
    await shelf3();
    await userEvent.click(screen.getByRole('button', { name: 'Shelf 3 actions' }));

    await userEvent.click(screen.getByRole('menuitem', { name: 'Move shelf' }));

    expect(screen.getByRole('dialog', { name: 'Move Shelf 3' })).toBeInTheDocument();
});

it('says when a shelf has no book', async () => {
    api();
    show();

    await shelf3();

    expect(screen.getByText('No book is on this shelf yet.')).toBeInTheDocument();
});

it('invites to add a shelf to a bookcase without shelves', async () => {
    api();

    show('/bookshelves?view=ribbons&bookcase=hall');

    expect(
        await screen.findByText('This bookcase has no shelf yet. Add one to assign books to it.'),
    ).toBeInTheDocument();
});

it('shows a Guest the shelves without managing them', async () => {
    api('guest');
    show();

    await shelf3();

    expect([
        screen.queryByRole('button', { name: 'Shelf 3 actions' }),
        screen.queryByRole('button', { name: 'Add shelf' }),
        screen.queryByRole('button', { name: 'New bookcase' }),
    ]).toEqual([null, null, null]);
});

it('switches to the Wall keeping the bookcase and the shelf', async () => {
    api().on('GET /bookcases/study/spines', () => ({
        status: 200,
        body: { bookcaseId: 'study', shelves: [{ shelfId: 'top', books: [] }] },
    }));
    const router = show('/bookshelves?view=ribbons&bookcase=study&shelf=top');

    await screen.findByRole('list', { name: 'Books on Top' });

    await userEvent.click(screen.getByRole('radio', { name: 'Wall' }));

    expect([
        await screen.findByRole('navigation', { name: 'Bookcases' }),
        router.state.location.search,
    ]).toEqual([expect.anything(), '?view=wall&bookcase=study&shelf=top']);
});
