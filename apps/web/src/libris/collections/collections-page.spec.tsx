import { screen, waitFor, within } from '@testing-library/react';
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
        category: 'comics',
        includesVolumeZero: false,
        finished: false,
        bookCount: 5,
        expectedFrom: 1,
        expectedTo: 12,
        expectedCount: 12,
        ownedCount: 4,
        missingCount: 8,
        lastOwned: 4,
        previews: [],
        ...overrides,
    };
}

function listing(items: CollectionSummaryDto[]) {
    return () => ({ status: 200, body: { total: items.length, items } });
}

function show(path = '/collections') {
    return renderRoute(path, { '/collections': <CollectionsPage /> });
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

it('previews a collection with the covers it was given, outside the link name', async () => {
    new FakeApi().signedIn(account()).on(
        'GET /collections',
        listing([
            summary({
                previews: [
                    { id: 'b1', title: 'Year One', updatedAt: '2026-01-01T00:00:00.000Z' },
                    {
                        id: 'b2',
                        title: 'The Long Halloween',
                        updatedAt: '2026-01-02T00:00:00.000Z',
                    },
                ],
            }),
        ]),
    );

    show();

    const batman = await screen.findByRole('link', { name: /Batman/ });

    expect(
        within(batman)
            .getAllByRole('img', { hidden: true })
            .map((image) => image.getAttribute('src')),
    ).toEqual([
        '/api/books/b1/cover?v=2026-01-01T00%3A00%3A00.000Z',
        '/api/books/b2/cover?v=2026-01-02T00%3A00%3A00.000Z',
    ]);
    expect(batman).toHaveAccessibleName('Batman, 4 / 12 volumes Owned, 8 missing · Unfinished');
});

it('shows no cover for a collection without previews', async () => {
    new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));

    show();

    const batman = await screen.findByRole('link', { name: /Batman/ });

    expect(within(batman).queryAllByRole('img', { hidden: true })).toEqual([]);
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

it('applies the advanced book filters to the collections, with the whole-collection counts', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /collections?limit=1', () => ({ status: 200, body: { total: 12, items: [] } }))
        .on('GET /collections', listing([summary()]));

    show('/collections?ownership=not-owned');

    expect(await screen.findByText('1 of 12 collections')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Batman/ })).toHaveTextContent('4 / 12 volumes Owned');
    expect(screen.getByRole('button', { name: 'Remove the filter Not owned' })).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).toContain(
        'GET /collections?search=&direction=asc&limit=48&ownership=not-owned&offset=0',
    );
});

it('ignores a collection filter left in the address of the Collections list', async () => {
    const api = new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));

    show('/collections?collection=none');

    await screen.findByRole('link', { name: /Batman/ });
    expect(api.calls.map((call) => call.route)).toContain(
        'GET /collections?search=&direction=asc&limit=48&offset=0',
    );
});
