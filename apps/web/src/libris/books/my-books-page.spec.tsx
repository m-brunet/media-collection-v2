import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { bookItem } from '../../testing/book-fixtures.test-support';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { ListMemory } from '../filters/list-memory.util';
import { choicesGiven } from '../filters/use-list-memory';
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

it('names the cover and price filters on their chips', async () => {
    filteredApi({ total: 2, items: [bookItem()] }, 842);

    show('/books?cover=without&price=with');

    expect(
        await screen.findByRole('button', { name: 'Remove the filter Without cover' }),
    ).toBeInTheDocument();
    expect(
        await screen.findByRole('button', { name: 'Remove the filter With price' }),
    ).toBeInTheDocument();
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

it('marks a lent book in the list', async () => {
    new FakeApi().signedIn(account()).on('GET /books', () => ({
        status: 200,
        body: {
            total: 1,
            items: [
                bookItem({
                    loan: {
                        id: 'l1',
                        receiverId: 'r-sam',
                        receiverName: 'Sam Taylor',
                        lentAt: '2026-10-30T09:00:00.000Z',
                    },
                }),
            ],
        },
    }));

    show();

    expect(await screen.findByRole('link', { name: /Piranesi/ })).toHaveTextContent(
        'Owned · Not read · Lent',
    );
});

function remember(accountId: string, choices: string) {
    ListMemory.write(accountId, 'books', new URLSearchParams(choices));
}

function listRequests(api: FakeApi) {
    return api.calls
        .map((call) => call.route)
        .filter((route) => route.startsWith('GET /books?search='));
}

function remembered() {
    return ListMemory.read('alex', 'books', false)?.toString();
}

it('restores the last filters and sort before asking for the list', async () => {
    const api = new FakeApi().signedIn(account());

    remember('alex', 'category=manga&sort=title-desc');

    show();

    await waitFor(() => expect(listRequests(api).length).toBeGreaterThan(0));
    expect(listRequests(api)).toEqual([
        'GET /books?search=&sort=title&direction=desc&limit=48&category=manga&offset=0',
    ]);
});

it('uses an explicit address alone, without the remembered choices', async () => {
    const api = new FakeApi().signedIn(account());

    remember('alex', 'category=manga&sort=title-desc');

    show('/books?tag=t1');

    await waitFor(() => expect(listRequests(api).length).toBeGreaterThan(0));
    expect(listRequests(api)).toEqual([
        'GET /books?search=&sort=title&direction=asc&limit=48&tag=t1&offset=0',
    ]);
});

it("does not use another account's choices", async () => {
    const api = new FakeApi().signedIn(account());

    remember('sam', 'category=manga');

    show();

    await waitFor(() => expect(listRequests(api).length).toBeGreaterThan(0));
    expect(listRequests(api)[0]).not.toContain('category=manga');
});

it('remembers a sort chosen on the list', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /books', () => ({ status: 200, body: { total: 1, items: [bookItem()] } }));
    show();
    await screen.findByRole('link', { name: /Piranesi/ });

    await userEvent.selectOptions(
        screen.getByRole('combobox', { name: 'Sort books' }),
        'Title Z–A',
    );

    await waitFor(() => expect(remembered()).toBe('sort=title-desc'));
});

it('keeps the list cleared after Clear filters, remembering no filter', async () => {
    new FakeApi().signedIn(account());
    remember('alex', 'category=manga&sort=title-desc');
    const router = show();
    const applied = await screen.findByRole('list', { name: 'Applied filters' });

    await userEvent.click(within(applied).getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(remembered()).toBe('sort=title-desc'));
    expect(router.state.location.search).toBe('?sort=title-desc');
});

it('keeps an empty selection applied from the advanced filters', async () => {
    const api = new FakeApi().signedIn(account());

    remember('alex', 'category=manga');

    renderRoute(
        { pathname: '/books', search: '', state: choicesGiven },
        { '/books': <MyBooksPage /> },
    );

    await waitFor(() => expect(listRequests(api).length).toBeGreaterThan(0));
    expect(listRequests(api)[0]).not.toContain('category=manga');
});

it('drops the reading filter remembered for a Guest', async () => {
    const api = new FakeApi().signedIn(account({ role: 'guest' }));

    ListMemory.write('alex', 'books', new URLSearchParams('reading=unread&category=comics'));

    show();

    await waitFor(() => expect(listRequests(api).length).toBeGreaterThan(0));
    expect(listRequests(api)).toEqual([
        'GET /books?search=&sort=title&direction=asc&limit=48&category=comics&offset=0',
    ]);
});

it('opens the list when the browser refuses storage', async () => {
    new FakeApi().signedIn(account());
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
    });

    show();

    expect(await screen.findByRole('combobox', { name: 'Sort books' })).toBeInTheDocument();
});

it('removes a deleted tag with a notice, keeping the other filters', async () => {
    new FakeApi().signedIn(account()).on('GET /tags', () => ({ status: 200, body: [] }));
    const router = show('/books?category=manga&tag=gone');

    await screen.findByText('A filter no longer exists and was removed: a tag.');

    await waitFor(() => expect(remembered()).toBe('category=manga'));
    expect(router.state.location.search).toBe('?category=manga');
});

it('removes a deleted shelf and a deleted collection together', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /bookcases', () => ({ status: 200, body: [] }))
        .on('GET /collections/gone', () => ({ status: 404, body: { message: 'Missing' } }));

    show('/books?location=shelf:old&collection=gone');

    expect(
        await screen.findByText(
            'Some filters no longer exist and were removed: a collection, a shelf.',
        ),
    ).toBeInTheDocument();
});

it('keeps a tag that still exists', async () => {
    const api = new FakeApi().signedIn(account()).on('GET /tags', () => ({
        status: 200,
        body: [{ id: 't1', name: 'Fantasy', bookCount: 1 }],
    }));

    show('/books?tag=t1');

    expect(
        await screen.findByRole('button', { name: 'Remove the filter Include: Fantasy' }),
    ).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).not.toContainEqual(expect.stringMatching(/tag=$/));
});

it('closes the notice of a removed filter', async () => {
    new FakeApi().signedIn(account()).on('GET /tags', () => ({ status: 200, body: [] }));
    show('/books?tag=gone');
    const notice = await screen.findByText('A filter no longer exists and was removed: a tag.');

    await userEvent.click(within(notice.closest('.notice')!).getByRole('button'));

    expect(screen.queryByText(/no longer exists/)).not.toBeInTheDocument();
});
