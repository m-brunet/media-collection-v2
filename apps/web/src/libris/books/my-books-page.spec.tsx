import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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

function show(path = '/books') {
    return renderRoute(path, {
        '/books': <MyBooksPage />,
        '/books/filters': <p>Filter page</p>,
    });
}

// Filtered requests answer `filtered`; the unfiltered library size request answers `total`.
function filteredApi(
    filtered: { total: number; items: ReturnType<typeof bookItem>[] },
    total: number,
) {
    return new FakeApi()
        .signedIn(account())
        .on('GET /tags', () => ({
            status: 200,
            body: [{ id: 'fantasy', name: 'Fantasy', bookCount: 6 }],
        }))
        .on('GET /books?limit=1', () => ({ status: 200, body: { total, items: [] } }))
        .on('GET /books', () => ({ status: 200, body: filtered }));
}

it('shows each book with its cover fallback, authors and statuses', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /books', () => ({ status: 200, body: { total: 1, items: [bookItem()] } }));

    show();

    const card = await screen.findByRole('link', { name: /Piranesi/ });

    expect(card).toHaveTextContent('Susanna Clarke');
    expect(card).toHaveTextContent('Owned · Not read');
    expect(card).toHaveTextContent('No cover');
    expect(card).toHaveAttribute('href', '/books/b1');
});

it('shows a Guest no reading status', async () => {
    new FakeApi().signedIn(account({ role: 'guest' })).on('GET /books', () => ({
        status: 200,
        body: { total: 1, items: [bookItem({ read: null })] },
    }));

    show();

    const card = await screen.findByRole('link', { name: /Piranesi/ });

    expect(card).not.toHaveTextContent('read');
    expect(screen.queryByRole('button', { name: 'Add a book' })).not.toBeInTheDocument();
});

it('invites an Owner to add the first book to an empty library', async () => {
    new FakeApi().signedIn(account());

    show();

    expect(await screen.findByText(/Your shared library is empty/)).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
});

it('searches as the person types', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /books', () => ({ status: 200, body: { total: 1, items: [bookItem()] } }));

    show();
    await screen.findByRole('link', { name: /Piranesi/ });

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search books' }), 'clarke');

    await waitFor(() =>
        expect(api.calls.map((call) => call.route)).toContain(
            'GET /books?search=clarke&sort=title&direction=asc&limit=48&offset=0',
        ),
    );
});

it('explains a search without result', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /books', () => ({ status: 200, body: { total: 1, items: [bookItem()] } }))
        .on('GET /books?search=zzz&sort=title&direction=asc&limit=48&offset=0', () => ({
            status: 200,
            body: { total: 0, items: [] },
        }));

    show();
    await screen.findByRole('link', { name: /Piranesi/ });

    await userEvent.type(screen.getByRole('searchbox'), 'zzz');

    expect(await screen.findByText('No book matches “zzz”.')).toBeInTheDocument();
});

it('sorts by most recently added', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /books', () => ({ status: 200, body: { total: 1, items: [bookItem()] } }));

    show();
    await screen.findByRole('link', { name: /Piranesi/ });

    await userEvent.selectOptions(
        screen.getByRole('combobox', { name: 'Sort books' }),
        'Recently added',
    );

    await waitFor(() =>
        expect(api.calls.map((call) => call.route)).toContain(
            'GET /books?search=&sort=added&direction=desc&limit=48&offset=0',
        ),
    );
});

it('loads the next books on request', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /books?search=&sort=title&direction=asc&limit=48&offset=0', () => ({
            status: 200,
            body: { total: 2, items: [bookItem()] },
        }))
        .on('GET /books?search=&sort=title&direction=asc&limit=48&offset=1', () => ({
            status: 200,
            body: { total: 2, items: [bookItem({ id: 'b2', title: 'Dune' })] },
        }));

    show();
    await screen.findByRole('link', { name: /Piranesi/ });

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('link', { name: /Dune/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
});

it('reports a list that cannot be loaded', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /books', () => ({ status: 500, body: { message: 'Failed' } }));

    show();

    expect(await screen.findByRole('alert')).toHaveTextContent('The request failed. Try again.');
});

it('shows the collection and volume of a book', async () => {
    new FakeApi().signedIn(account()).on('GET /books', () => ({
        status: 200,
        body: {
            total: 1,
            items: [bookItem({ collection: { name: 'Batman', volumeFrom: 12, volumeTo: 12 } })],
        },
    }));

    show();

    expect(await screen.findByRole('link', { name: /Piranesi/ })).toHaveTextContent(
        'Batman · Volume 12',
    );
});

it('shows the applied filters as removable chips with the matching count', async () => {
    filteredApi({ total: 6, items: [bookItem()] }, 842);

    show('/books?ownership=owned&tag=fantasy');

    expect(
        await screen.findByRole('button', { name: 'Remove the filter Owned' }),
    ).toBeInTheDocument();
    expect(
        await screen.findByRole('button', { name: 'Remove the filter Include: Fantasy' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('6 of 842 books')).toBeInTheDocument();
});

it('names the chosen author and collection of a bookmarked filter', async () => {
    filteredApi({ total: 1, items: [bookItem()] }, 842)
        .on('GET /authors/by-id', () => ({
            status: 200,
            body: [{ id: 'clarke', name: 'Susanna Clarke' }],
        }))
        .on('GET /collections/batman', () => ({
            status: 200,
            body: { id: 'batman', name: 'Batman' },
        }));

    show('/books?author=clarke&collection=batman');

    expect(
        await screen.findByRole('button', { name: 'Remove the filter Susanna Clarke' }),
    ).toBeInTheDocument();
    expect(
        await screen.findByRole('button', { name: 'Remove the filter Batman' }),
    ).toBeInTheDocument();
});

it('asks the server for the filtered books', async () => {
    const api = filteredApi({ total: 6, items: [bookItem()] }, 842);

    show('/books?ownership=owned&location=none&notTag=fantasy');

    await screen.findByText('6 of 842 books');
    expect(api.calls.map((call) => call.route)).toContain(
        'GET /books?search=&sort=title&direction=asc&limit=48&location=none&ownership=owned&notTag=fantasy&offset=0',
    );
});

it('removes one filter from its chip', async () => {
    filteredApi({ total: 6, items: [bookItem()] }, 842);
    const router = show('/books?ownership=owned&tag=fantasy');

    await userEvent.click(await screen.findByRole('button', { name: 'Remove the filter Owned' }));

    expect(router.state.location.search).toBe('?tag=fantasy');
});

it('opens the advanced filters with the current search', async () => {
    filteredApi({ total: 1, items: [bookItem()] }, 1);
    const router = show('/books?search=tolk');

    await userEvent.click(await screen.findByRole('button', { name: 'Advanced filters' }));

    expect(router.state.location.pathname).toBe('/books/filters');
    expect(router.state.location.search).toBe('?search=tolk');
});

it('offers to clear the filters when nothing matches them', async () => {
    filteredApi({ total: 0, items: [] }, 842);
    const router = show('/books?search=Tolkien&ownership=owned');

    await screen.findByText('No matching books');

    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1)!);

    expect(
        screen.queryByText(
            'No book matches “Tolkien” with the current filters. Try another term or clear your filters.',
        ),
    ).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
});
