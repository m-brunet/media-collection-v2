import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CollectionSummaryDto } from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { CollectionsPage } from './collections-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function summary(overrides: Partial<CollectionSummaryDto> = {}): CollectionSummaryDto {
    return {
        id: 'c1',
        name: 'Batman',
        includesVolumeZero: false,
        finished: false,
        bookCount: 5,
        expectedFrom: 1,
        expectedTo: 12,
        expectedCount: 12,
        ownedCount: 4,
        missingCount: 8,
        lastOwned: 4,
        ...overrides,
    };
}

function listing(items: CollectionSummaryDto[]) {
    return () => ({ status: 200, body: { total: items.length, items } });
}

function show() {
    return renderRoute('/collections', { '/collections': <CollectionsPage /> });
}

it('shows each collection with its whole-collection counts', async () => {
    new FakeApi().signedIn(account()).on(
        'GET /collections',
        listing([
            summary(),
            summary({ id: 'c2', name: 'Dune', ownedCount: 6, expectedCount: 6, missingCount: 0 }),
            summary({
                id: 'c3',
                name: 'The Lord of the Rings',
                ownedCount: 3,
                expectedCount: 3,
                missingCount: 0,
                finished: true,
            }),
        ]),
    );

    show();

    const batman = await screen.findByRole('link', { name: /Batman/ });

    expect(batman).toHaveTextContent('4 / 12 volumes Owned');
    expect(batman).toHaveTextContent('8 missing · Unfinished');
    expect(batman).toHaveAttribute('href', '/collections/c1');
    expect(screen.getByRole('link', { name: /Dune/ })).toHaveTextContent(
        'No known missing volumes · Unfinished',
    );
    expect(screen.getByRole('link', { name: /Lord of the Rings/ })).toHaveTextContent('Finished');
});

it('invites an Owner to add a book when no collection exists', async () => {
    new FakeApi().signedIn(account()).on('GET /collections', listing([]));

    show();

    expect(
        await screen.findByText(
            'No collections yet. Add a book with a collection name to create one.',
        ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a book' })).toBeInTheDocument();
});

it('offers a Guest no way to add books', async () => {
    new FakeApi().signedIn(account({ role: 'guest' })).on('GET /collections', listing([]));

    show();

    expect(await screen.findByText('No collection has been created yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a book' })).not.toBeInTheDocument();
});

it('searches collections through their books', async () => {
    const api = new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));

    show();
    await screen.findByRole('link', { name: /Batman/ });

    await userEvent.type(screen.getByRole('searchbox'), 'year one');

    await waitFor(() =>
        expect(api.calls.map((call) => call.route)).toContainEqual(
            expect.stringContaining('/collections?search=year+one'),
        ),
    );
});

it('sorts collections from Z to A', async () => {
    const api = new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));

    show();
    await screen.findByRole('link', { name: /Batman/ });

    await userEvent.selectOptions(
        screen.getByRole('combobox', { name: 'Sort collections' }),
        'desc',
    );

    await waitFor(() =>
        expect(api.calls.map((call) => call.route)).toContainEqual(
            expect.stringContaining('direction=desc'),
        ),
    );
});
