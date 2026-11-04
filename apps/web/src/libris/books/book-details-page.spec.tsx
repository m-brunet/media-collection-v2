import { screen, within } from '@testing-library/react';
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
    const toggle = await screen.findByRole('button', { name: 'Read' });

    await userEvent.click(toggle);

    expect(await screen.findByText('Your status: Read.')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
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
