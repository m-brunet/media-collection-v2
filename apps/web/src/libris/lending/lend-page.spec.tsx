import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { bookDto, bookItem } from '../../testing/book-fixtures.test-support';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { LendPage } from './lend-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const lending = {
    receiver: { id: 'r-sam', name: 'Sam Taylor' },
    loans: [{ loanId: 'l1', bookId: 'b1', lentAt: '2026-10-30T09:00:00.000Z' }],
};

function lendingApi() {
    return new FakeApi()
        .signedIn(account())
        .on('GET /books/b1', () => ({ status: 200, body: bookDto() }))
        .on('GET /receivers', () => ({ status: 200, body: [] }))
        .on('POST /loans', () => ({ status: 201, body: lending }));
}

function show() {
    return renderRoute('/loans/lend?book=b1', { '/loans/lend': <LendPage /> });
}

function selection() {
    return screen.getByRole('list', { name: /^Selected books/ });
}

it('starts with the book the person came from', async () => {
    lendingApi();

    show();

    expect(await screen.findByRole('list', { name: 'Selected books · 1' })).toHaveTextContent(
        'Piranesi',
    );
    expect(selection()).toHaveTextContent('Bloomsbury · September 2020 · ISBN 9781635575637');
    expect(screen.getByRole('button', { name: 'Enter a receiver name' })).toBeDisabled();
});

it('lends the starting book to a typed receiver and lists the loans', async () => {
    const api = lendingApi();

    show();
    await screen.findByRole('list', { name: 'Selected books · 1' });
    await userEvent.type(screen.getByLabelText(/^Receiver name/), 'Sam Taylor');

    await userEvent.click(screen.getByRole('button', { name: 'Lend 1 book' }));

    expect(await screen.findByText('Elsewhere: /loans')).toBeInTheDocument();
    expect(api.calls).toContainEqual({
        route: 'POST /loans',
        body: { receiver: { name: 'Sam Taylor' }, bookIds: ['b1'] },
    });
});

it('asks for at least one book once the starting book is removed', async () => {
    lendingApi();
    show();
    await screen.findByRole('list', { name: 'Selected books · 1' });
    await userEvent.type(screen.getByLabelText(/^Receiver name/), 'Sam Taylor');

    await userEvent.click(
        screen.getByRole('button', { name: 'Remove Piranesi from the selection' }),
    );

    expect(screen.getByRole('button', { name: 'Select at least one book' })).toBeDisabled();
    expect(screen.getByText('No books selected')).toBeInTheDocument();
});

it('adds other books found by title, explaining those that cannot be lent', async () => {
    lendingApi().on('GET /books?limit=8&search=dune', () => ({
        status: 200,
        body: {
            total: 3,
            items: [
                bookItem({ id: 'b2', title: 'Dune' }),
                bookItem({ id: 'b3', title: 'Children of Dune', ownership: 'not-owned' }),
                bookItem({
                    id: 'b4',
                    title: 'Dune Messiah',
                    loan: {
                        id: 'l9',
                        receiverId: 'r-morgan',
                        receiverName: 'Morgan',
                        lentAt: '2026-10-01T09:00:00.000Z',
                    },
                }),
            ],
        },
    }));
    show();
    await screen.findByRole('list', { name: 'Selected books · 1' });
    await userEvent.type(screen.getByLabelText('Find a book'), 'dune');
    const found = await screen.findByRole('list', { name: 'Add other books' });

    await userEvent.click(within(found).getByRole('button', { name: 'Add Dune to the selection' }));

    expect(screen.getByRole('list', { name: 'Selected books · 2' })).toHaveTextContent('Dune');
    expect(found).toHaveTextContent('Not Owned');
    expect(found).toHaveTextContent('Already lent to Morgan');
    expect(within(found).queryAllByRole('button')).toHaveLength(0);
});

it('asks about a similar receiver and reuses the one chosen', async () => {
    let attempts = 0;
    const api = lendingApi().on('POST /loans', () =>
        ++attempts === 1
            ? {
                  status: 409,
                  body: {
                      reason: 'receiver-similar',
                      message: 'Similar',
                      details: {
                          name: 'Sam Tayler',
                          candidates: [{ id: 'r-sam', name: 'Sam Taylor' }],
                      },
                  },
              }
            : { status: 201, body: lending },
    );

    show();
    await screen.findByRole('list', { name: 'Selected books · 1' });
    await userEvent.type(screen.getByLabelText(/^Receiver name/), 'Sam Tayler');
    await userEvent.click(screen.getByRole('button', { name: 'Lend 1 book' }));
    await screen.findByText('Did you mean Sam Taylor?');
    await userEvent.click(screen.getByRole('button', { name: 'Use Sam Taylor' }));

    await userEvent.click(screen.getByRole('button', { name: 'Lend 1 book' }));

    expect(await screen.findByText('Elsewhere: /loans')).toBeInTheDocument();
    expect(api.calls.at(-1)).toEqual({
        route: 'POST /loans',
        body: { receiver: { id: 'r-sam' }, bookIds: ['b1'] },
    });
});

it('creates a distinct receiver once the person confirms a similar name is someone else', async () => {
    let attempts = 0;
    const api = lendingApi().on('POST /loans', () =>
        ++attempts === 1
            ? {
                  status: 409,
                  body: {
                      reason: 'receiver-similar',
                      message: 'Similar',
                      details: {
                          name: 'Sam Tayler',
                          candidates: [{ id: 'r-sam', name: 'Sam Taylor' }],
                      },
                  },
              }
            : { status: 201, body: lending },
    );

    show();
    await screen.findByRole('list', { name: 'Selected books · 1' });
    await userEvent.type(screen.getByLabelText(/^Receiver name/), 'Sam Tayler');
    await userEvent.click(screen.getByRole('button', { name: 'Lend 1 book' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Create “Sam Tayler”' }));

    await userEvent.click(screen.getByRole('button', { name: 'Lend 1 book' }));

    expect(await screen.findByText('Elsewhere: /loans')).toBeInTheDocument();
    expect(api.calls.at(-1)).toEqual({
        route: 'POST /loans',
        body: { receiver: { name: 'Sam Tayler', distinct: true }, bookIds: ['b1'] },
    });
});

it('keeps the draft and marks the book lent meanwhile by another account', async () => {
    let reads = 0;

    lendingApi()
        .on('GET /books/b1', () => ({
            status: 200,
            body:
                ++reads === 1
                    ? bookDto()
                    : bookDto({
                          loan: {
                              id: 'l9',
                              receiverId: 'r-morgan',
                              receiverName: 'Morgan',
                              lentAt: '2026-10-30T08:00:00.000Z',
                          },
                      }),
        }))
        .on('POST /loans', () => ({
            status: 409,
            body: {
                reason: 'book-already-lent',
                message: 'Lent',
                details: { bookIds: ['b1'] },
            },
        }));
    show();
    await screen.findByRole('list', { name: 'Selected books · 1' });
    await userEvent.type(screen.getByLabelText(/^Receiver name/), 'Sam Taylor');

    await userEvent.click(screen.getByRole('button', { name: 'Lend 1 book' }));

    expect(await screen.findByText(/Already lent: Piranesi/)).toBeInTheDocument();
    expect(await within(selection()).findByText('Already lent to Morgan')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Receiver name/)).toHaveValue('Sam Taylor');
    expect(screen.getByRole('button', { name: 'Lend 1 book' })).toBeDisabled();
});

it('tells when a typed name is an existing receiver', async () => {
    lendingApi().on('GET /receivers', () => ({
        status: 200,
        body: [{ id: 'r-sam', name: 'Sam Taylor' }],
    }));
    show();
    await screen.findByRole('list', { name: 'Selected books · 1' });

    await userEvent.type(screen.getByLabelText(/^Receiver name/), 'sam taylor');

    expect(await screen.findByText('Existing receiver selected.')).toBeInTheDocument();
});
