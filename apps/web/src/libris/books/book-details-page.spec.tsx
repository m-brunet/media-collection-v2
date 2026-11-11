import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { bookDto } from '../../testing/book-fixtures.test-support';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { BookDetailsPage } from './book-details-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function show() {
    return renderRoute('/books/b1', { '/books/:id': <BookDetailsPage /> });
}

it('shows the shared information', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({ status: 200, body: bookDto() }));

    show();

    expect(await screen.findByRole('heading', { name: 'Piranesi' })).toBeInTheDocument();
    expect(screen.getByText('Bloomsbury · September 2020')).toBeInTheDocument();
    expect(screen.getByText('272 pages · €16.90')).toBeInTheDocument();
    expect(screen.getByText('Books · Owned')).toBeInTheDocument();
});

it('explains an ISBN converted from ISBN-10', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({
        status: 200,
        body: bookDto({ isbn: '9780306406157', isbnConvertedFromIsbn10: true }),
    }));

    show();

    expect(await screen.findByRole('img', { name: 'About this ISBN' })).toBeInTheDocument();
    expect(screen.getByText('9780306406157')).toHaveAccessibleDescription(
        'Converted from the equivalent ISBN-10 you supplied.',
    );
});

it('shows no conversion mark for an ISBN-13 entered as such', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({ status: 200, body: bookDto() }));

    show();

    await screen.findByRole('heading', { name: 'Piranesi' });
    expect(screen.queryByRole('img', { name: 'About this ISBN' })).not.toBeInTheDocument();
});

it('marks the book read for the viewer only', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /books/b1', () => ({ status: 200, body: bookDto() }))
        .on('PUT /books/b1/reading', () => ({ status: 200, body: { read: true } }));

    show();
    const toggle = await screen.findByRole('button', { name: 'Not read' });

    await userEvent.click(toggle);

    expect(await screen.findByRole('button', { name: 'Read' })).toHaveClass('button--pressed');
    expect(api.calls).toContainEqual({ route: 'PUT /books/b1/reading', body: { read: true } });
});

it('adds a personal note', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /books/b1', () => ({ status: 200, body: bookDto() }))
        .on('PUT /books/b1/note', (body) => ({
            status: 200,
            body: { text: (body as { text: string }).text, updatedAt: '2026-01-02T00:00:00.000Z' },
        }));

    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Add a personal note' }));
    await userEvent.type(screen.getByLabelText(/Personal note/), 'A favourite.');

    await userEvent.click(screen.getByRole('button', { name: 'Save note' }));

    expect(await screen.findByText('A favourite.')).toBeInTheDocument();
    expect(screen.getByText('Note saved.')).toBeInTheDocument();
});

it('deletes the personal note and offers to add one again', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /books/b1', () => ({
            status: 200,
            body: bookDto({
                personal: {
                    read: false,
                    note: { text: 'Mine.', updatedAt: '2026-01-01T00:00:00Z' },
                },
            }),
        }))
        .on('DELETE /books/b1/note', () => ({ status: 204 }));

    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete note' }));

    expect(await screen.findByRole('button', { name: 'Add a personal note' })).toBeInTheDocument();
    expect(screen.queryByText('Mine.')).not.toBeInTheDocument();
});

it('gives a Guest no reading status, notes, edit or delete', async () => {
    new FakeApi()
        .signedIn(account({ role: 'guest' }))
        .on('GET /books/b1', () => ({ status: 200, body: bookDto({ personal: null }) }));

    show();

    await screen.findByRole('heading', { name: 'Piranesi' });
    expect(screen.queryByText('Only your reading')).not.toBeInTheDocument();
    expect(screen.queryByText(/private note/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit book' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete book' })).not.toBeInTheDocument();
});

it('deletes the book after confirmation', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /books/b1', () => ({ status: 200, body: bookDto() }))
        .on('DELETE /books/b1', () => ({ status: 204 }));

    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete book' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this book?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete book' }));

    expect(await screen.findByText('Elsewhere: /books')).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).toContain('DELETE /books/b1');
});

it('explains a book that no longer exists', async () => {
    new FakeApi().signedIn(account());

    show();

    expect(await screen.findByText('This book no longer exists')).toBeInTheDocument();
});

it('links to the collection with the covered volumes', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({
        status: 200,
        body: bookDto({ collection: { id: 'c1', name: 'Batman', volumeFrom: 1, volumeTo: 3 } }),
    }));

    show();

    expect(await screen.findByRole('link', { name: 'Batman · Volumes 1–3' })).toHaveAttribute(
        'href',
        '/collections/c1',
    );
});

const bookcases = [
    {
        id: 'oak',
        name: 'Oak bookcase',
        bookCount: 3,
        shelves: [
            { id: 's1', bookcaseId: 'oak', name: 'Shelf 1', bookCount: 1 },
            { id: 's3', bookcaseId: 'oak', name: 'Shelf 3', bookCount: 2 },
        ],
    },
    { id: 'hall', name: 'Hall bookcase', bookCount: 0, shelves: [] },
];

function organised() {
    return bookDto({
        location: {
            bookcaseId: 'oak',
            bookcaseName: 'Oak bookcase',
            shelfId: 's1',
            shelfName: 'Shelf 1',
        },
        tags: [
            { id: 't1', name: 'Fantasy' },
            { id: 't2', name: 'Literary fiction' },
        ],
    });
}

it('saves a new shelf as soon as it is chosen', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /books/b1', () => ({ status: 200, body: organised() }))
        .on('GET /bookcases', () => ({ status: 200, body: bookcases }))
        .on('PATCH /books/b1/organisation', () => ({
            status: 200,
            body: {
                ...organised(),
                location: {
                    bookcaseId: 'oak',
                    bookcaseName: 'Oak bookcase',
                    shelfId: 's3',
                    shelfName: 'Shelf 3',
                },
            },
        }));

    show();

    await userEvent.selectOptions(
        await screen.findByLabelText('Physical location'),
        'Oak bookcase – Shelf 3',
    );

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(api.calls.find((call) => call.route === 'PATCH /books/b1/organisation')?.body).toEqual({
        shelfId: 's3',
    });
});

it('saves the removal of a tag from this book only', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /books/b1', () => ({ status: 200, body: organised() }))
        .on('GET /bookcases', () => ({ status: 200, body: bookcases }))
        .on('PATCH /books/b1/organisation', () => ({
            status: 200,
            body: { ...organised(), tags: [{ id: 't2', name: 'Literary fiction' }] },
        }));

    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Remove the tag Fantasy' }));

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(api.calls.find((call) => call.route === 'PATCH /books/b1/organisation')?.body).toEqual({
        tags: [{ id: 't2' }],
    });
});

it('restores the saved location and explains a refused change', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /books/b1', () => ({ status: 200, body: organised() }))
        .on('GET /bookcases', () => ({ status: 200, body: bookcases }))
        .on('PATCH /books/b1/organisation', () => ({
            status: 404,
            body: { message: 'Missing', reason: 'shelf-missing' },
        }));
    show();
    const select = await screen.findByLabelText('Physical location');

    await userEvent.selectOptions(select, 'Oak bookcase – Shelf 3');

    expect(
        await screen.findByText('This shelf no longer exists. Choose another one.'),
    ).toBeInTheDocument();
    expect(select).toHaveValue('s1');
});

it('returns to the last confirmed change when a later one is refused', async () => {
    let saves = 0;

    new FakeApi()
        .signedIn(account())
        .on('GET /books/b1', () => ({ status: 200, body: organised() }))
        .on('GET /bookcases', () => ({ status: 200, body: bookcases }))
        .on('PATCH /books/b1/organisation', () =>
            ++saves === 1
                ? {
                      status: 200,
                      body: {
                          ...organised(),
                          location: {
                              bookcaseId: 'oak',
                              bookcaseName: 'Oak bookcase',
                              shelfId: 's3',
                              shelfName: 'Shelf 3',
                          },
                      },
                  }
                : { status: 404, body: { message: 'Missing', reason: 'tag-missing' } },
        );
    show();
    const select = await screen.findByLabelText('Physical location');
    const remove = screen.getByRole('button', { name: 'Remove the tag Fantasy' });

    fireEvent.change(select, { target: { value: 's3' } });
    fireEvent.click(remove);

    expect(
        await screen.findByText('One of the tags no longer exists. Choose the tags again.'),
    ).toBeInTheDocument();
    expect(select).toHaveValue('s3');
    expect(screen.getByRole('button', { name: 'Remove the tag Fantasy' })).toBeInTheDocument();
});

it('shows a Guest the location and tags without editing them', async () => {
    new FakeApi()
        .signedIn(account({ role: 'guest' }))
        .on('GET /books/b1', () => ({ status: 200, body: { ...organised(), personal: null } }));

    show();

    expect(await screen.findByText('Oak bookcase – Shelf 1')).toBeInTheDocument();
    expect(screen.getByText('Fantasy')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Find or create tag' })).not.toBeInTheDocument();
});

it('shows who has a lent book and offers to record its return', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({
        status: 200,
        body: bookDto({
            loan: {
                id: 'l1',
                receiverId: 'r-sam',
                receiverName: 'Sam Taylor',
                lentAt: '2026-10-30T09:00:00.000Z',
            },
        }),
    }));
    show();
    await screen.findByText('Lent to Sam Taylor');

    await userEvent.click(screen.getByRole('button', { name: 'Record return' }));

    expect(await screen.findByText('Elsewhere: /loans/return')).toBeInTheDocument();
});

it('explains that a lent book must be returned before deletion', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({
        status: 200,
        body: bookDto({
            loan: {
                id: 'l1',
                receiverId: 'r-sam',
                receiverName: 'Sam Taylor',
                lentAt: '2026-10-30T09:00:00.000Z',
            },
        }),
    }));

    show();

    expect(await screen.findByText('Lent on 30 October 2026')).toBeInTheDocument();
    expect(
        screen.getByText('Return this book before deleting it or changing it to Not Owned.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lend' })).not.toBeInTheDocument();
});

it('shows a Guest who has a lent book without the return action', async () => {
    new FakeApi().signedIn(account({ role: 'guest' })).on('GET /books/b1', () => ({
        status: 200,
        body: bookDto({
            loan: {
                id: 'l1',
                receiverId: 'r-sam',
                receiverName: 'Sam Taylor',
                lentAt: '2026-10-30T09:00:00.000Z',
            },
            personal: null,
        }),
    }));

    show();

    expect(await screen.findByText('Lent to Sam Taylor')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record return' })).not.toBeInTheDocument();
});

it('opens the lending page from an Owned book that is not lent', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({ status: 200, body: bookDto() }));
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Lend' }));

    expect(await screen.findByText('Elsewhere: /loans/lend')).toBeInTheDocument();
});

it('offers no lending for a Not Owned book', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({
        status: 200,
        body: bookDto({ ownership: 'not-owned' }),
    }));

    show();

    expect(await screen.findByRole('heading', { name: 'Piranesi' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lend' })).not.toBeInTheDocument();
});

it('offers a Guest no lending', async () => {
    new FakeApi().signedIn(account({ role: 'guest' })).on('GET /books/b1', () => ({
        status: 200,
        body: bookDto({ personal: null }),
    }));

    show();

    expect(await screen.findByRole('heading', { name: 'Piranesi' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lend' })).not.toBeInTheDocument();
});

it('tells that a title was named from its collection', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({
        status: 200,
        body: bookDto({ title: 'Gunnm Vol. 3', titleGenerated: true, category: 'manga' }),
    }));

    show();

    expect(await screen.findByText('Named from its collection')).toBeInTheDocument();
});

it('shows no naming mark for a supplied title', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({ status: 200, body: bookDto() }));

    show();

    expect(await screen.findByRole('heading', { name: 'Piranesi' })).toBeInTheDocument();
    expect(screen.queryByText('Named from its collection')).not.toBeInTheDocument();
});
