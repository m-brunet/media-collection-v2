import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { bookItem } from '../../testing/book-fixtures.test-support';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import type { MovedBook } from './move-book-dialog';
import { MoveBookDialog } from './move-book-dialog';

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
        size: 'large',
        bookCount: 1,
        shelves: [
            { id: 's1', bookcaseId: 'oak', name: 'Shelf 1', bookCount: 0 },
            { id: 's3', bookcaseId: 'oak', name: 'Shelf 3', bookCount: 1 },
        ],
    },
    {
        id: 'study',
        name: 'Study bookcase',
        size: 'large',
        bookCount: 0,
        shelves: [{ id: 'top', bookcaseId: 'study', name: 'Top', bookCount: 0 }],
    },
];
const dune = bookItem({ id: 'dune', title: 'Dune' });

function show(onMoved: (moved: MovedBook) => void = vi.fn()) {
    renderRoute('/', {
        '/': (
            <MoveBookDialog
                book={dune}
                bookcases={bookcases}
                from={{ bookcaseId: 'oak', shelfId: 's3' }}
                onMoved={onMoved}
                onClose={vi.fn()}
            />
        ),
    });

    return screen.getByRole('dialog', { name: 'Move “Dune”' });
}

it('names the book being moved and starts from its shelf', async () => {
    new FakeApi().signedIn(account());

    const dialog = show();

    expect([
        (within(dialog).getByRole('combobox', { name: 'Physical location' }) as HTMLSelectElement)
            .value,
        within(dialog).getByRole('button', { name: 'Move book' }),
    ]).toEqual(['s3', expect.objectContaining({ disabled: true })]);
});

it('moves the book to the chosen shelf and tells where it went', async () => {
    const calls = new FakeApi()
        .signedIn(account())
        .on('PATCH /books/dune/organisation', () => ({ status: 200, body: {} }));
    const onMoved = vi.fn();
    const dialog = show(onMoved);

    await userEvent.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Physical location' }),
        'Study bookcase – Top',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'Move book' }));

    expect([
        calls.calls.find((call) => call.route === 'PATCH /books/dune/organisation')?.body,
        onMoved.mock.calls[0]?.[0]?.message,
    ]).toEqual([{ shelfId: 'top' }, '“Dune” is now on Study bookcase / Top.']);
});

it('keeps the book where it was and explains a refused move', async () => {
    new FakeApi().signedIn(account()).on('PATCH /books/dune/organisation', () => ({
        status: 404,
        body: { message: 'Missing', reason: 'shelf-missing' },
    }));
    const onMoved = vi.fn();
    const dialog = show(onMoved);

    await userEvent.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Physical location' }),
        'Oak bookcase – Shelf 1',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'Move book' }));

    expect([await within(dialog).findByRole('alert'), onMoved.mock.calls.length]).toEqual([
        expect.anything(),
        0,
    ]);
});
