import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
    CollectionDetailsDto,
    CollectionMemberDto,
} from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { CollectionDetailsPage } from './collection-details-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function member(overrides: Partial<CollectionMemberDto> = {}): CollectionMemberDto {
    return {
        id: 'year-one',
        title: 'Year One',
        isbn: '9781401207526',
        publisher: null,
        category: 'comics',
        ownership: 'owned',
        hasCover: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
        volumeFrom: 1,
        volumeTo: 1,
        ...overrides,
    };
}

const omnibus = member({ id: 'omnibus', title: 'Batman omnibus', isbn: null, volumeTo: 3 });

function batman(overrides: Partial<CollectionDetailsDto> = {}): CollectionDetailsDto {
    return {
        id: 'c1',
        name: 'Batman',
        includesVolumeZero: false,
        finished: false,
        bookCount: 3,
        expectedFrom: 1,
        expectedTo: 12,
        expectedCount: 12,
        ownedCount: 3,
        missingCount: 9,
        lastOwned: 3,
        previews: [],
        volumes: [
            { from: 1, to: 1, state: 'owned', books: [member(), omnibus] },
            { from: 2, to: 3, state: 'owned', books: [omnibus] },
            { from: 4, to: 11, state: 'inferred', books: [] },
            {
                from: 12,
                to: 12,
                state: 'planned',
                books: [
                    member({
                        id: 'twelve',
                        title: 'Batman 12',
                        ownership: 'not-owned',
                        volumeFrom: 12,
                        volumeTo: 12,
                    }),
                ],
            },
        ],
        ...overrides,
    };
}

function show() {
    return renderRoute('/collections/c1', {
        '/collections/:id': <CollectionDetailsPage />,
    });
}

it('shows whole-collection counts and the expected range', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();

    expect(await screen.findByRole('heading', { name: 'Batman' })).toBeInTheDocument();
    expect(screen.getByText('3 of 12 expected volumes Owned')).toBeInTheDocument();
    expect(screen.getByText('9 missing · Unfinished')).toBeInTheDocument();
    expect(screen.getByText('Expected coverage: Volumes 1–12')).toBeInTheDocument();
    expect(
        screen.getByText('Includes volume 0: Off · Highest saved coverage: 12'),
    ).toBeInTheDocument();
});

it('expands a volume to choose one of its editions', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();
    const volume = await screen.findByRole('button', { name: /Volume 1 Owned · 2 editions/ });

    await userEvent.click(volume);

    const editions = document.getElementById(volume.getAttribute('aria-controls')!)!;

    expect(volume).toHaveAttribute('aria-expanded', 'true');
    expect(
        within(editions).getByRole('link', { name: 'View this book · Year One' }),
    ).toHaveAttribute('href', '/books/year-one');
    expect(within(editions).getByText('Omnibus · Covers 1–3 · One book')).toBeVisible();
});

it('describes inferred and planned volumes as missing', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();

    expect(
        await screen.findByRole('button', { name: /Volumes 4–11 Missing · Inferred coverage/ }),
    ).toBeDisabled();
    expect(
        screen.getByRole('button', { name: /Volume 12 Missing · Saved Not Owned edition/ }),
    ).toBeEnabled();
});

it('explains why an incomplete collection cannot be marked Finished', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();

    const finish = await screen.findByRole('button', { name: 'Mark Finished' });

    expect(finish).toBeDisabled();
    expect(finish).toHaveAccessibleDescription(
        'Own every expected volume before marking this collection Finished.',
    );
});

it('marks a complete collection Finished', async () => {
    const complete = batman({ missingCount: 0, ownedCount: 3, expectedTo: 3, expectedCount: 3 });
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /collections/c1', () => ({ status: 200, body: complete }))
        .on('POST /collections/c1/finish', () => ({
            status: 200,
            body: { ...complete, finished: true },
        }));

    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark Finished' }));

    expect(await screen.findByText('Complete · Finished')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen collection' })).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).toContain('POST /collections/c1/finish');
});

it('renames the collection and includes volume 0', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /collections/c1', () => ({ status: 200, body: batman() }))
        .on('PATCH /collections/c1', (body) => ({
            status: 200,
            body: {
                ...batman(),
                name: 'The Batman',
                includesVolumeZero: true,
                ...(body as object),
            },
        }));

    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit collection' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit collection' });
    const name = within(dialog).getByRole('textbox', { name: /Collection name/ });

    await userEvent.clear(name);
    await userEvent.type(name, 'The Batman');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Includes volume 0' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save collection' }));

    expect(await screen.findByRole('heading', { name: 'The Batman' })).toBeInTheDocument();
    expect(api.calls.find((call) => call.route === 'PATCH /collections/c1')?.body).toEqual({
        name: 'The Batman',
        includesVolumeZero: true,
    });
});

it('deletes the collection after confirming that its books are kept', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /collections/c1', () => ({ status: 200, body: batman() }))
        .on('DELETE /collections/c1', () => ({ status: 204 }));

    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit collection' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete collection' }));
    const confirmation = screen.getByRole('dialog', { name: 'Delete this collection?' });
    const explanation = within(confirmation).getByText(/stay in your library/);

    await userEvent.click(within(confirmation).getByRole('button', { name: 'Delete collection' }));

    expect(explanation).toHaveTextContent('The books of “Batman” stay in your library');
    expect(await screen.findByText('Elsewhere: /collections')).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).toContain('DELETE /collections/c1');
});

it('offers a Guest no changes', async () => {
    new FakeApi().signedIn(account({ role: 'guest' })).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();

    await screen.findByRole('heading', { name: 'Batman' });
    expect(screen.queryByRole('button', { name: 'Edit collection' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark Finished' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a book' })).not.toBeInTheDocument();
});

it('explains that a collection no longer exists', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 404,
        body: { message: 'Missing', reason: 'collection-missing' },
    }));

    show();

    expect(await screen.findByText('This collection no longer exists')).toBeInTheDocument();
    await waitFor(() =>
        expect(screen.getByRole('link', { name: 'Back to collections' })).toBeInTheDocument(),
    );
});
