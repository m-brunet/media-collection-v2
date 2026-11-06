import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReceiverLoansDto } from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { ReturnPage } from './return-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function loan(id: string, title: string) {
    return {
        loanId: 'loan-' + id,
        lentAt: '2026-10-25T09:00:00.000Z',
        book: {
            id,
            title,
            authors: [],
            publisher: null,
            publicationYear: null,
            isbn: null,
            hasCover: false,
            updatedAt: '2026-01-01T00:00:00.000Z',
        },
    };
}

function sam(...loans: ReturnType<typeof loan>[]): ReceiverLoansDto[] {
    return [{ receiver: { id: 'r-sam', name: 'Sam Taylor' }, loans }];
}

const all = sam(loan('piranesi', 'Piranesi'), loan('dune', 'Dune'), loan('overstory', 'Overstory'));

function returnsApi() {
    return new FakeApi()
        .signedIn(account())
        .on('GET /loans', () => ({ status: 200, body: all }))
        .on('POST /loans/returns', () => ({
            status: 200,
            body: {
                receiver: { id: 'r-sam', name: 'Sam Taylor' },
                returned: [{ loanId: 'loan-dune', bookId: 'dune', returnedAt: 'x' }],
            },
        }));
}

function show() {
    return renderRoute('/loans/return?receiver=r-sam&loan=loan-dune', {
        '/loans/return': <ReturnPage />,
    });
}

it('offers every book lent to the receiver with the starting book preselected', async () => {
    returnsApi();

    show();

    expect(
        await screen.findByText(
            'Returns from Sam Taylor · All 3 active loans, across lending occasions.',
        ),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^Dune/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^Piranesi/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^Dune/ })).toHaveAccessibleName(
        /Starting book · Lent 25 October 2026 · Selected to return/,
    );
    expect(screen.getByText('1 of 3 books')).toBeInTheDocument();
});

it('records only the selected return and leaves the other books lent', async () => {
    const api = returnsApi();

    show();
    await screen.findByText('1 of 3 books');

    await userEvent.click(screen.getByRole('button', { name: 'Record 1 return' }));

    expect(await screen.findByText('Elsewhere: /loans')).toBeInTheDocument();
    expect(api.calls).toContainEqual({
        route: 'POST /loans/returns',
        body: { loanIds: ['loan-dune'] },
    });
});

it('returns books selected together, across lending occasions', async () => {
    const api = returnsApi();

    show();
    await screen.findByText('1 of 3 books');
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));

    await userEvent.click(screen.getByRole('button', { name: 'Record 3 returns' }));

    expect(api.calls.at(-1)).toEqual({
        route: 'POST /loans/returns',
        body: { loanIds: ['loan-piranesi', 'loan-dune', 'loan-overstory'] },
    });
});

it('lets the starting book be unselected but asks for at least one book', async () => {
    returnsApi();
    show();
    await screen.findByText('1 of 3 books');

    await userEvent.click(screen.getByRole('checkbox', { name: /^Dune/ }));

    expect(screen.getByRole('button', { name: 'Select at least one book' })).toBeDisabled();
    expect(screen.getByText('0 of 3 books')).toBeInTheDocument();
});

it('saves nothing when a book was returned meanwhile, and shows the current loans', async () => {
    let reads = 0;

    returnsApi()
        .on('GET /loans', () => ({
            status: 200,
            body:
                ++reads === 1
                    ? all
                    : sam(loan('piranesi', 'Piranesi'), loan('overstory', 'Overstory')),
        }))
        .on('POST /loans/returns', () => ({
            status: 409,
            body: { reason: 'loan-already-returned', message: 'Returned', details: {} },
        }));
    show();
    await screen.findByText('1 of 3 books');
    await userEvent.click(screen.getByRole('checkbox', { name: /^Piranesi/ }));

    await userEvent.click(screen.getByRole('button', { name: 'Record 2 returns' }));

    expect(await screen.findByText(/None of your selected returns were saved/)).toBeInTheDocument();
    expect(await screen.findByText('1 of 2 books')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^Dune/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^Piranesi/ })).toBeChecked();
});

it('explains a receiver with nothing on loan', async () => {
    new FakeApi().signedIn(account()).on('GET /loans', () => ({ status: 200, body: [] }));

    show();

    expect(await screen.findByText('This receiver has no book on loan.')).toBeInTheDocument();
});
