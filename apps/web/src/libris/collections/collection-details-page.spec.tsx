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
    expect(screen.getByText('Expected coverage: volumes 1–12')).toBeInTheDocument();
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
    expect(within(editions).getByText('Omnibus · Covers 1–3')).toBeVisible();
});

it('describes an edition by its cover, publisher and ISBN', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman({
            volumes: [
                {
                    from: 1,
                    to: 1,
                    state: 'owned',
                    books: [
                        member({
                            publisher: 'DC Comics',
                            hasCover: true,
                            updatedAt: '2026-02-01T00:00:00.000Z',
                        }),
                    ],
                },
            ],
        }),
    }));

    show();
    await userEvent.click(await screen.findByRole('button', { name: /Volume 1 Owned/ }));

    const edition = screen.getByText('Year One').closest('li')!;

    expect(within(edition).getByText('DC Comics · ISBN 9781401207526')).toBeVisible();
    expect(within(edition).getByRole('img', { name: 'Cover of Year One' })).toHaveAttribute(
        'src',
        '/api/books/year-one/cover?v=2026-02-01T00%3A00%3A00.000Z',
    );
});

it('explains what Finished means for a Finished collection', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman({ finished: true, missingCount: 0 }),
    }));

    show();

    expect(
        await screen.findByText(
            'Finished collections remain on desktop and are hidden from mobile shopping.',
        ),
    ).toBeInTheDocument();
    expect(
        screen.queryByText('Own every expected volume before marking this collection Finished.'),
    ).not.toBeInTheDocument();
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

it('gives a Guest no reading status', async () => {
    const api = new FakeApi()
        .signedIn(account({ role: 'guest' }))
        .on('GET /collections/c1', () => ({ status: 200, body: batman() }));

    show();

    await screen.findByRole('heading', { name: 'Batman' });
    expect(screen.queryByText('Only your reading')).not.toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).not.toContain('GET /collections/c1/reading');
});

function batchApi() {
    return new FakeApi()
        .signedIn(account())
        .on('GET /collections/c1', () => ({ status: 200, body: batman() }))
        .on('POST /books/batch-edit', (body) => ({
            status: 200,
            body: {
                collection: { id: 'c1', name: 'Batman' },
                saved: !(body as { preview: boolean }).preview,
                books: [
                    {
                        id: 'omnibus',
                        title: 'Batman omnibus',
                        before: {
                            title: 'Batman omnibus',
                            titleGenerated: false,
                            priceCents: 2500,
                        },
                        after: { title: 'Batman Vol. 1–3', titleGenerated: true, priceCents: null },
                    },
                    { id: 'year-one', title: 'Year One', before: {}, after: {} },
                ],
                skipped: [{ id: 'twelve', title: 'Batman 12', reason: 'book-lent' }],
            },
        }));
}

async function chooseAllAndOpen() {
    await userEvent.click(await screen.findByRole('button', { name: 'Edit several' }));
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit 3 books' }));

    return screen.getByRole('dialog', { name: 'Edit the chosen books (3)' });
}

async function chooseGeneratedTitles(dialog: HTMLElement) {
    await userEvent.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Titles' }),
        'generated',
    );
}

it('offers a Guest no Edit several mode', async () => {
    new FakeApi().signedIn(account({ role: 'guest' })).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();

    await screen.findByRole('heading', { name: 'Batman' });
    expect(screen.queryByRole('button', { name: 'Edit several' })).not.toBeInTheDocument();
});

it('adds a checkbox to each book in the Edit several mode', async () => {
    batchApi();
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Edit several' }));

    expect(screen.getAllByRole('checkbox').map((box) => box.parentElement!.textContent)).toEqual([
        'Volumes 1–3 · Batman omnibus · Owned',
        'Volume 1 · Year One · Owned',
        'Volume 12 · Batman 12 · Not owned',
    ]);
    expect(screen.getByRole('button', { name: 'Edit 0 books' })).toBeDisabled();
});

it('selects the owned books of the collection', async () => {
    batchApi();
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit several' }));

    await userEvent.click(screen.getByRole('button', { name: 'Select owned' }));

    expect(screen.getByRole('checkbox', { name: /Year One/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Batman omnibus/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Batman 12/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Edit 2 books' })).toBeEnabled();
});

it('selects every book of the collection', async () => {
    batchApi();
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit several' }));

    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));

    expect(screen.getAllByRole('checkbox').map((box) => (box as HTMLInputElement).checked)).toEqual(
        [true, true, true],
    );
});

it('sends only the fields changed from Leave unchanged', async () => {
    const api = batchApi();

    show();
    const dialog = await chooseAllAndOpen();

    await userEvent.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Publisher' }),
        'set',
    );
    await userEvent.type(
        within(dialog).getByRole('textbox', { name: 'Publisher: new value' }),
        'DC Comics',
    );
    await userEvent.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Price (€)' }),
        'clear',
    );
    await chooseGeneratedTitles(dialog);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));

    expect(api.calls.find((call) => call.route === 'POST /books/batch-edit')?.body).toEqual({
        collectionId: 'c1',
        bookIds: ['omnibus', 'year-one', 'twelve'],
        preview: true,
        changes: { publisher: 'DC Comics', price: null, generatedTitles: true },
    });
});

it('asks for a change before reviewing', async () => {
    const api = batchApi();

    show();
    const dialog = await chooseAllAndOpen();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));

    expect(within(dialog).getByText('Choose at least one change.')).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).not.toContain('POST /books/batch-edit');
});

it('summarises the title changes and the books left out before saving', async () => {
    batchApi();
    show();
    const dialog = await chooseAllAndOpen();

    await chooseGeneratedTitles(dialog);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));

    const changes = await within(dialog).findByRole('list', { name: 'Planned changes' });
    const skipped = within(dialog).getByRole('list', { name: 'Left out' });

    expect(
        within(changes).getByText('Title: Batman omnibus → Batman Vol. 1–3'),
    ).toBeInTheDocument();
    expect(within(changes).getByText('Price: €25.00 → none')).toBeInTheDocument();
    expect(within(changes).getByText('Already as asked: no change')).toBeInTheDocument();
    expect(within(skipped).getByText('Lent: cannot be set to Not owned')).toBeInTheDocument();
});

it('saves the batch and refreshes the collection', async () => {
    const api = batchApi();

    show();
    const dialog = await chooseAllAndOpen();

    await chooseGeneratedTitles(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));
    await within(dialog).findByRole('list', { name: 'Planned changes' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('1 book updated.')).toBeInTheDocument();
    expect(
        api.calls.filter((call) => call.route === 'POST /books/batch-edit').at(-1)?.body,
    ).toMatchObject({
        preview: false,
        changes: { generatedTitles: true },
    });
    expect(api.calls.filter((call) => call.route === 'GET /collections/c1')).toHaveLength(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

function reading(read: boolean, ownedCount = 3) {
    return new FakeApi()
        .signedIn(account())
        .on('GET /collections/c1', () => ({ status: 200, body: batman() }))
        .on('GET /collections/c1/reading', () => ({ status: 200, body: { read, ownedCount } }));
}

it('shows Not read while an owned book of the collection is unread', async () => {
    reading(false);

    show();

    const toggle = await screen.findByRole('button', { name: 'Not read' });

    expect(toggle).not.toHaveClass('button--pressed');
    expect(
        screen.getByText(
            'Applies to the 3 owned books of this collection. This does not change another account’s status.',
        ),
    ).toBeInTheDocument();
});

it('shows Read pressed once every owned book is read', async () => {
    reading(true, 1);

    show();

    expect(await screen.findByRole('button', { name: 'Read' })).toHaveClass('button--pressed');
    expect(screen.getByText(/^Applies to the owned book of this collection\./)).toBeInTheDocument();
});

it('offers no reading status for a collection without owned books', async () => {
    reading(false, 0);

    show();

    await screen.findByRole('heading', { name: 'Batman' });
    await waitFor(() => expect(screen.queryByText('Only your reading')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Not read' })).not.toBeInTheDocument();
});

it('marks every owned book read at once, without confirmation', async () => {
    const api = reading(false).on('PUT /collections/c1/reading', () => ({
        status: 200,
        body: { read: true, ownedCount: 3 },
    }));

    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Not read' }));

    expect(await screen.findByRole('button', { name: 'Read' })).toHaveClass('button--pressed');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls).toContainEqual({
        route: 'PUT /collections/c1/reading',
        body: { read: true },
    });
});

it('asks before marking the whole collection not read', async () => {
    const api = reading(true);

    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Read' }));

    const dialog = screen.getByRole('dialog', { name: 'Mark the whole collection as not read?' });

    expect(
        within(dialog).getByText(
            'Your reading status of every owned book of “Batman” becomes Not read. Other accounts keep theirs.',
        ),
    ).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).not.toContain('PUT /collections/c1/reading');
});

it('keeps the collection read when the confirmation is cancelled', async () => {
    const api = reading(true);

    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Read' }));
    const dialog = screen.getByRole('dialog', { name: 'Mark the whole collection as not read?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read' })).toHaveClass('button--pressed');
    expect(api.calls.map((call) => call.route)).not.toContain('PUT /collections/c1/reading');
});

it('marks every owned book not read once confirmed', async () => {
    const api = reading(true).on('PUT /collections/c1/reading', () => ({
        status: 200,
        body: { read: false, ownedCount: 3 },
    }));

    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Read' }));
    const dialog = screen.getByRole('dialog', { name: 'Mark the whole collection as not read?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as not read' }));

    expect(await screen.findByRole('button', { name: 'Not read' })).not.toHaveClass(
        'button--pressed',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls).toContainEqual({
        route: 'PUT /collections/c1/reading',
        body: { read: false },
    });
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
