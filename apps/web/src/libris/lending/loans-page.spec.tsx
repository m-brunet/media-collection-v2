import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReceiverLoansDto } from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { LoansPage } from './loans-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function loan(id: string, title: string, lentAt: string) {
    return {
        loanId: 'loan-' + id,
        lentAt,
        book: {
            id,
            title,
            authors: ['Susanna Clarke'],
            publisher: null,
            publicationYear: null,
            isbn: null,
            hasCover: false,
        },
    };
}

const groups: ReceiverLoansDto[] = [
    {
        receiver: { id: 'r-alexandra', name: 'Alexandra Montgomery-Worthington' },
        loans: [loan('sweetgrass', 'Braiding Sweetgrass', '2026-10-22T09:00:00.000Z')],
    },
    {
        receiver: { id: 'r-sam', name: 'Sam Taylor' },
        loans: [
            loan('piranesi', 'Piranesi', '2026-10-30T09:00:00.000Z'),
            loan('dune', 'Dune', '2026-10-25T09:00:00.000Z'),
        ],
    },
];

function show() {
    return renderRoute('/loans', { '/loans': <LoansPage /> });
}

function group(name: string) {
    return screen.getByRole('region', { name });
}

it('shows the lent books grouped by receiver with their lending dates', async () => {
    new FakeApi().signedIn(account()).on('GET /loans', () => ({ status: 200, body: groups }));

    show();

    const sam = await screen.findByRole('region', { name: 'Sam Taylor' });

    expect(screen.getByText('3 books currently lent · 2 receivers')).toBeInTheDocument();
    expect(sam).toHaveTextContent('2 books currently lent');
    expect(within(sam).getByRole('link', { name: 'Piranesi' })).toHaveAttribute(
        'href',
        '/books/piranesi',
    );
    expect(sam).toHaveTextContent('Lent 30 October 2026');
    expect(group('Alexandra Montgomery-Worthington')).toHaveTextContent('Lent 22 October 2026');
});

it('opens the returns of the receiver from a lent book', async () => {
    new FakeApi().signedIn(account()).on('GET /loans', () => ({ status: 200, body: groups }));
    show();
    await screen.findByRole('region', { name: 'Sam Taylor' });

    await userEvent.click(screen.getByRole('button', { name: 'Record the return of Dune' }));

    expect(await screen.findByText('Elsewhere: /loans/return')).toBeInTheDocument();
});

it('shows a Guest the loans without return actions', async () => {
    new FakeApi()
        .signedIn(account({ role: 'guest' }))
        .on('GET /loans', () => ({ status: 200, body: groups }));

    show();

    expect(await screen.findByRole('region', { name: 'Sam Taylor' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Record the return/ })).not.toBeInTheDocument();
});

it('explains that nothing is lent', async () => {
    new FakeApi().signedIn(account()).on('GET /loans', () => ({ status: 200, body: [] }));

    show();

    expect(await screen.findByText('No books currently lent.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse books' })).toHaveAttribute('href', '/books');
});

it('searches receiver names and titles as the person types', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /loans', () => ({ status: 200, body: groups }))
        .on('GET /loans?search=nobody', () => ({ status: 200, body: [] }));

    show();
    await screen.findByRole('region', { name: 'Sam Taylor' });

    await userEvent.type(screen.getByLabelText('Search loans'), 'nobody');

    expect(await screen.findByText('No loan matches “nobody”.')).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).toContain('GET /loans?search=nobody');
});

it('reports loans that cannot be loaded and tries again on request', async () => {
    let attempts = 0;

    new FakeApi()
        .signedIn(account())
        .on('GET /loans', () =>
            ++attempts === 1
                ? { status: 500, body: { message: 'Down' } }
                : { status: 200, body: groups },
        );
    show();
    await screen.findByText('The request failed. Try again.');

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('region', { name: 'Sam Taylor' })).toBeInTheDocument();
});
