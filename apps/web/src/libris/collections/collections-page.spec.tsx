import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CollectionSummaryDto } from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { ListMemory } from '../filters/list-memory.util';
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
        status: 'unfinished',
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
                status: 'finished',
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
    expect(batman).toHaveAccessibleName(
        'Batman, Comics, 4 / 12 volumes Owned, 8 missing · Unfinished',
    );
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

function statusGroup() {
    return screen.findByRole('group', { name: 'Status' });
}

function routes(api: FakeApi) {
    return api.calls.map((call) => call.route);
}

it('starts on All collections', async () => {
    const api = new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));

    show();

    await screen.findByRole('link', { name: /Batman/ });
    expect([within(await statusGroup()).getByRole('radio', { name: 'All' }), routes(api)]).toEqual([
        expect.objectContaining({ checked: true }),
        expect.arrayContaining(['GET /collections?search=&direction=asc&limit=48&offset=0']),
    ]);
});

it('shows the unfinished collections from the first page, keeping the other criteria', async () => {
    const api = new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));
    const router = show('/collections?direction=desc&category=manga');

    await userEvent.click(within(await statusGroup()).getByRole('radio', { name: 'Unfinished' }));

    await waitFor(() =>
        expect(routes(api)).toContain(
            'GET /collections?search=&direction=desc&limit=48&finished=false&category=manga&offset=0',
        ),
    );
    expect(router.state.location.search).toBe('?direction=desc&category=manga&finished=false');
});

it('removes the status from the address for All', async () => {
    new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));
    const router = show('/collections?finished=true');

    await userEvent.click(within(await statusGroup()).getByRole('radio', { name: 'All' }));

    expect(router.state.location.search).toBe('');
});

it('reads an unknown status of the address as All', async () => {
    const api = new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));
    const router = show('/collections?finished=maybe');

    await screen.findByRole('link', { name: /Batman/ });

    expect([router.state.location.search, routes(api)]).toEqual([
        '',
        expect.not.arrayContaining([expect.stringContaining('finished=')]),
    ]);
});

it('keeps the status when opening the advanced filters', async () => {
    new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));
    const router = renderRoute('/collections?finished=true', {
        '/collections': <CollectionsPage />,
        '/collections/filters': <p>Filters</p>,
    });

    await statusGroup();

    await userEvent.click(screen.getByRole('button', { name: 'Advanced filters' }));

    expect(router.state.location.search).toBe('?finished=true');
});

it('clears the status with the other filters, keeping the sort and the search', async () => {
    new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));
    const router = show('/collections?search=bat&direction=desc&finished=true&ownership=owned');

    await statusGroup();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(router.state.location.search).toBe('?search=bat&direction=desc');
});

it('keeps the toolbar and offers to clear when no collection has the status', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /collections?limit=1', () => ({ status: 200, body: { total: 3, items: [] } }))
        .on('GET /collections?search=&direction=desc&limit=48&finished=true&offset=0', listing([]))
        .on('GET /collections', listing([summary()]));
    const router = show('/collections?direction=desc&finished=true');

    await screen.findByText('No matching collections');

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect([screen.getByRole('group', { name: 'Status' }), router.state.location.search]).toEqual([
        expect.anything(),
        '?direction=desc',
    ]);
});

it('offers a Guest the status choice', async () => {
    new FakeApi().signedIn(account({ role: 'guest' })).on('GET /collections', listing([summary()]));

    show();

    expect(
        within(await statusGroup())
            .getAllByRole('radio')
            .map((radio) => radio.closest('label')?.textContent),
    ).toEqual(['All', 'Unfinished', 'Finished']);
});

it('restores the last status, filters and direction before asking for the list', async () => {
    const api = new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));

    ListMemory.write(
        'alex',
        'collections',
        new URLSearchParams('category=manga&direction=desc&finished=false'),
    );

    show();

    await screen.findByRole('link', { name: /Batman/ });
    expect(routes(api).filter((route) => route.includes('offset=0'))).toEqual([
        'GET /collections?search=&direction=desc&limit=48&finished=false&category=manga&offset=0',
    ]);
});

it('shows the Dropped label on the card of a dropped collection', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /collections', listing([summary({ status: 'dropped' })]));

    show();

    const batman = await screen.findByRole('link', { name: /Batman/ });

    expect(batman).toHaveTextContent('Dropped');
    expect(within(batman).getByText('Dropped')).toHaveClass('collection-card__status--dropped');
});

it('asks only for the dropped collections with the advanced Dropped filter', async () => {
    const api = new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));

    show('/collections?dropped=true');

    await screen.findByRole('link', { name: /Batman/ });
    expect(screen.getByRole('button', { name: 'Remove the filter Dropped' })).toBeVisible();
    expect(routes(api)).toContain(
        'GET /collections?search=&direction=asc&limit=48&dropped=true&offset=0',
    );
});

it('restores a remembered Dropped filter', async () => {
    const api = new FakeApi().signedIn(account()).on('GET /collections', listing([summary()]));

    ListMemory.write('alex', 'collections', new URLSearchParams('dropped=true'));

    show();

    await screen.findByRole('link', { name: /Batman/ });
    expect(routes(api).filter((route) => route.includes('offset=0'))).toEqual([
        'GET /collections?search=&direction=asc&limit=48&dropped=true&offset=0',
    ]);
});
