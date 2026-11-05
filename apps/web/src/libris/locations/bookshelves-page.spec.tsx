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
});

const bookcases: BookcaseDto[] = [
    {
        id: 'oak',
        name: 'Oak bookcase',
        bookCount: 64,
        shelves: [
            { id: 's1', bookcaseId: 'oak', name: 'Shelf 1', bookCount: 0 },
            { id: 's3', bookcaseId: 'oak', name: 'Shelf 3', bookCount: 64 },
        ],
    },
    {
        id: 'study',
        name: 'Study bookcase',
        bookCount: 1,
        shelves: [{ id: 'top', bookcaseId: 'study', name: 'Top', bookCount: 1 }],
    },
];

function show(path = '/bookshelves') {
    return renderRoute(path, { '/bookshelves': <BookshelvesPage /> });
}

function api(role: 'owner' | 'guest' = 'owner') {
    return new FakeApi()
        .signedIn(account({ role }))
        .on('GET /bookcases', () => ({ status: 200, body: bookcases }))
        .on('GET /books', () => ({
            status: 200,
            body: { total: 1, items: [bookItem({ title: 'Dune' })] },
        }));
}

function tree() {
    return screen.getByRole('navigation', { name: 'Bookcases and shelves' });
}

it('shows each bookcase with its shelves and book counts', async () => {
    api();

    show();

    expect(await screen.findByText('2 bookcases · 3 shelves')).toBeInTheDocument();
    expect(within(tree()).getByRole('button', { name: 'Shelf 3 · 64 books' })).toBeInTheDocument();
    expect(within(tree()).getByRole('button', { name: 'Top · 1 book' })).toBeInTheDocument();
});

it('lists the books of the selected shelf', async () => {
    const calls = api();

    show();
    await screen.findByText('2 bookcases · 3 shelves');

    await userEvent.click(within(tree()).getByRole('button', { name: 'Top · 1 book' }));

    expect(await screen.findByRole('heading', { name: '1 book on Top' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Dune/ })).toHaveAttribute('href', '/books/b1');
    expect(calls.calls.map((call) => call.route)).toContain(
        'GET /books?location=shelf%3Atop&limit=24&offset=0',
    );
});

it('finds a shelf by name ignoring case', async () => {
    api();
    show();
    await screen.findByText('2 bookcases · 3 shelves');

    await userEvent.type(screen.getByLabelText('Search bookcases and shelves'), 'TOP');

    expect(within(tree()).getByRole('button', { name: 'Top · 1 book' })).toBeInTheDocument();
    expect(within(tree()).queryByText('Oak bookcase')).not.toBeInTheDocument();
});

it('creates a shelf in the chosen bookcase', async () => {
    const calls = api().on('POST /bookcases/study/shelves', () => ({
        status: 201,
        body: { id: 'bottom', bookcaseId: 'study', name: 'Bottom', bookCount: 0 },
    }));

    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Add shelf' }));
    const dialog = screen.getByRole('dialog', { name: 'Create a shelf' });

    await userEvent.selectOptions(within(dialog).getByLabelText(/Bookcase/), 'Study bookcase');
    await userEvent.type(within(dialog).getByLabelText(/Shelf name/), 'Bottom');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create shelf' }));

    expect(await screen.findByText('“Bottom” was created.')).toBeInTheDocument();
    expect(calls.calls).toContainEqual({
        route: 'POST /bookcases/study/shelves',
        body: { name: 'Bottom' },
    });
});

it('moves a shelf to another bookcase and explains a name conflict there', async () => {
    api().on('PATCH /shelves/s3', () => ({
        status: 409,
        body: { message: 'Taken', reason: 'shelf-name-taken' },
    }));
    show('/bookshelves?shelf=s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Move shelf' }));
    const dialog = screen.getByRole('dialog', { name: 'Move Shelf 3' });

    await userEvent.selectOptions(within(dialog).getByLabelText(/Bookcase/), 'Study bookcase');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Move shelf' }));

    expect(
        await within(dialog).findByText(
            'This bookcase already has a shelf with an equivalent name.',
        ),
    ).toBeInTheDocument();
});

it('tells how many books become unassigned before deleting a shelf', async () => {
    api();
    show('/bookshelves?shelf=s3');

    await userEvent.click(await screen.findByRole('button', { name: 'Delete shelf' }));

    expect(
        within(screen.getByRole('dialog', { name: 'Delete Shelf 3?' })).getByText(
            '64 books will become unassigned. No books will be deleted. The shelf definition will be removed.',
        ),
    ).toBeInTheDocument();
});

it('tells which shelves go with a deleted bookcase', async () => {
    api();
    show('/bookshelves?shelf=s3');

    await userEvent.click(await screen.findByRole('button', { name: 'Delete bookcase' }));

    expect(
        within(screen.getByRole('dialog', { name: 'Delete Oak bookcase?' })).getByText(
            '64 books will become unassigned. No books will be deleted. The bookcase and its 2 shelf definitions will be removed.',
        ),
    ).toBeInTheDocument();
});

it('deletes a shelf once confirmed', async () => {
    const calls = api().on('DELETE /shelves/s3', () => ({ status: 204 }));

    show('/bookshelves?shelf=s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete shelf' }));

    await userEvent.click(
        within(screen.getByRole('dialog', { name: 'Delete Shelf 3?' })).getByRole('button', {
            name: 'Delete shelf',
        }),
    );

    expect(
        await screen.findByText('“Shelf 3” was deleted. Its books were kept.'),
    ).toBeInTheDocument();
    expect(calls.calls.map((call) => call.route)).toContain('DELETE /shelves/s3');
});

it('shows a Guest the locations without managing them', async () => {
    api('guest');

    show();

    expect(await screen.findByText('2 bookcases · 3 shelves')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New bookcase' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete shelf' })).not.toBeInTheDocument();
});

it('invites to create the first bookcase', async () => {
    new FakeApi().signedIn(account()).on('GET /bookcases', () => ({ status: 200, body: [] }));

    show();

    expect(
        await screen.findByText(
            'Create a bookcase, then add shelves inside it. Books may remain unassigned.',
        ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create bookcase' })).toBeInTheDocument();
});
