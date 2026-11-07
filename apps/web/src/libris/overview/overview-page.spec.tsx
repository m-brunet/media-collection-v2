import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { OverviewDto } from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { OverviewPage } from './overview-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function overview(overrides: Partial<OverviewDto> = {}): OverviewDto {
    return {
        ownedBooks: 842,
        collections: 6,
        bookcases: 3,
        shelves: 9,
        lentBooks: 5,
        recentlyAdded: [
            {
                id: 'b1',
                title: 'The Overstory',
                authors: ['Richard Powers'],
                hasCover: false,
                updatedAt: '2026-11-01T10:00:00.000Z',
                read: false,
            },
            {
                id: 'b2',
                title: 'Dune',
                authors: ['Frank Herbert'],
                hasCover: false,
                updatedAt: '2026-10-01T10:00:00.000Z',
                read: true,
            },
        ],
        reading: { read: 318, notRead: 524 },
        bookcaseList: [
            { id: 'c1', name: 'Hall', shelfCount: 1 },
            { id: 'c2', name: 'Oak', shelfCount: 4 },
        ],
        ...overrides,
    };
}

function guestOverview(): OverviewDto {
    const shared = overview();

    return {
        ...shared,
        recentlyAdded: shared.recentlyAdded.map((book) => ({ ...book, read: null })),
        reading: null,
    };
}

function counter(label: string) {
    return screen.getByText(label, { selector: 'dt' }).closest('div')!;
}

function show() {
    return renderRoute('/', { '/': <OverviewPage /> });
}

it('shows the library counters', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /overview', () => ({ status: 200, body: overview() }));

    show();

    expect(await screen.findByText('842')).toBeInTheDocument();
    expect(counter('Owned books')).toHaveTextContent('842');
    expect(counter('Collections')).toHaveTextContent('6');
    expect(counter('Bookcases / shelves')).toHaveTextContent('3 / 9');
    expect(counter('Currently lent')).toHaveTextContent('5');
});

it('links each recently added book to its details', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /overview', () => ({ status: 200, body: overview() }));

    show();

    const list = await screen.findByRole('list', { name: 'Recently added' });

    expect(
        within(list)
            .getAllByRole('link')
            .map((link) => link.getAttribute('href')),
    ).toEqual(['/books/b1', '/books/b2']);
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Richard Powers');
});

it('shows an Owner their own reading on the recent books', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /overview', () => ({ status: 200, body: overview() }));

    show();

    const list = await screen.findByRole('list', { name: 'Recently added' });

    expect(
        within(list)
            .getAllByRole('listitem')
            .map((item) => item.textContent),
    ).toEqual([
        expect.stringContaining('Owned · Not read'),
        expect.stringContaining('Owned · Read'),
    ]);
});

it('shows an Owner their own reading summary', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /overview', () => ({ status: 200, body: overview() }));

    show();

    expect(await screen.findByText('318 Read / 524 Not read')).toBeInTheDocument();
    expect(screen.getByText('Your reading · Owned books')).toBeInTheDocument();
});

it('shows a Guest no reading summary and no reading status', async () => {
    new FakeApi()
        .signedIn(account({ role: 'guest' }))
        .on('GET /overview', () => ({ status: 200, body: guestOverview() }));

    show();

    const list = await screen.findByRole('list', { name: 'Recently added' });

    expect(screen.queryByText('Your reading · Owned books')).not.toBeInTheDocument();
    expect(list).not.toHaveTextContent('Read');
});

it('offers Add a book to an Owner', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /overview', () => ({ status: 200, body: overview() }));
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Add a book' }));

    expect(screen.getByText('Elsewhere: /books/new')).toBeInTheDocument();
});

it('offers no Add a book to a Guest', async () => {
    new FakeApi()
        .signedIn(account({ role: 'guest' }))
        .on('GET /overview', () => ({ status: 200, body: guestOverview() }));

    show();

    await screen.findByText('842');
    expect(screen.queryByRole('button', { name: 'Add a book' })).not.toBeInTheDocument();
});

it('lists the bookcases with their shelf counts', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /overview', () => ({ status: 200, body: overview() }));

    show();

    expect(await screen.findByText('Hall · 1 shelf')).toBeInTheDocument();
    expect(screen.getByText('Oak · 4 shelves')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage physical locations →' })).toHaveAttribute(
        'href',
        '/bookshelves',
    );
});

it('links to all books, newest first', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /overview', () => ({ status: 200, body: overview() }));

    show();

    expect(await screen.findByRole('link', { name: 'View all books →' })).toHaveAttribute(
        'href',
        '/books?sort=added-desc',
    );
});

it('explains an empty library', async () => {
    new FakeApi().signedIn(account()).on('GET /overview', () => ({
        status: 200,
        body: overview({
            ownedBooks: 0,
            recentlyAdded: [],
            bookcaseList: [],
            reading: { read: 0, notRead: 0 },
        }),
    }));

    show();

    expect(await screen.findByText('No books yet')).toBeInTheDocument();
    expect(screen.getByText('No bookcases yet.')).toBeInTheDocument();
});

it('shows a failure and loads again on Try again', async () => {
    let attempts = 0;

    new FakeApi().signedIn(account()).on('GET /overview', () => {
        attempts++;

        return attempts === 1
            ? { status: 500, body: { message: 'Down' } }
            : { status: 200, body: overview() };
    });
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('842')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
