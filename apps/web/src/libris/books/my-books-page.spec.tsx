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

function show() {
    return renderRoute('/books', { '/books': <MyBooksPage /> });
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
