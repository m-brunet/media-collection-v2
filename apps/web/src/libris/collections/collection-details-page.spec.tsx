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
        category: 'comics',
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
    expect(screen.getByText('9 missing')).toBeInTheDocument();
    expect(screen.getByText('Expected coverage: volumes 1–12')).toBeInTheDocument();
    expect(
        screen.getByText('Includes volume 0: Off · Highest saved coverage: 12'),
    ).toBeInTheDocument();
});

function volumes() {
    return screen.getByRole('region', { name: 'Volumes' });
}

it('shows a cover of each book in volume order, with the missing volumes in their place', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();

    await screen.findByRole('heading', { name: 'Batman' });
    expect(
        within(volumes())
            .getAllByRole('listitem')
            .map((tile) => tile.textContent),
    ).toEqual([
        'No coverBatman omnibusOwned · Omnibus 1–3',
        'No coverYear OneOwned',
        '4Volume 4Missing',
        '5Volume 5Missing',
        '6Volume 6Missing',
        '7Volume 7Missing',
        '8Volume 8Missing',
        '9Volume 9Missing',
        '10Volume 10Missing',
        '11Volume 11Missing',
        'No coverBatman 12Not owned',
    ]);
});

it('opens a book from its cover', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();

    const book = await screen.findByRole('link', { name: 'Year One, Owned' });

    expect(book).toHaveAttribute('href', '/books/year-one');
    expect(screen.getByRole('link', { name: 'Batman 12, Not owned' })).toHaveAttribute(
        'href',
        '/books/twelve',
    );
});

it('shows the cover image of a book that has one', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman({
            volumes: [
                {
                    from: 1,
                    to: 1,
                    state: 'owned',
                    books: [member({ hasCover: true, updatedAt: '2026-02-01T00:00:00.000Z' })],
                },
            ],
        }),
    }));

    show();

    const book = await screen.findByRole('link', { name: 'Year One, Owned' });

    expect(book.querySelector('img')).toHaveAttribute(
        'src',
        '/api/books/year-one/cover?v=2026-02-01T00%3A00%3A00.000Z',
    );
    expect(book).toHaveTextContent(/^Year One/);
});

it('shows a missing volume as an empty slot that opens nothing', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();

    const missing = (await screen.findByText('Volume 10')).closest('li')!;

    expect(missing).toHaveTextContent('Missing');
    expect(within(missing).queryByRole('link')).not.toBeInTheDocument();
    expect(within(missing).queryByRole('button')).not.toBeInTheDocument();
    expect(within(volumes()).getAllByRole('link')).toHaveLength(3);
});

it('labels an unfinished collection Unfinished by its name', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();

    const label = await screen.findByText('Unfinished');

    expect(label).toHaveClass('collection-label--unfinished');
    expect(label).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('labels a Finished collection Finished by its name', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman({ finished: true, missingCount: 0 }),
    }));

    show();

    const label = await screen.findByText('Finished');

    expect(label).toHaveClass('collection-label--finished');
    expect(label).toHaveAccessibleDescription(
        'Finished collections remain on desktop and are hidden from mobile shopping.',
    );
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
    expect(screen.getByText('Complete')).toBeInTheDocument();
});

it('explains what Finished means on hover of the Finished label', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman({ finished: true, missingCount: 0 }),
    }));
    show();
    const label = await screen.findByText('Finished');

    await userEvent.hover(label);

    expect(screen.getByRole('tooltip')).toHaveTextContent(
        'Finished collections remain on desktop and are hidden from mobile shopping.',
    );
});

it('explains what Finished means when the Finished label has keyboard focus', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman({ finished: true, missingCount: 0 }),
    }));
    show();
    const label = await screen.findByText('Finished');

    label.focus();

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
        'Finished collections remain on desktop and are hidden from mobile shopping.',
    );
});

it('explains why an incomplete collection cannot be marked Finished', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();

    const finish = await screen.findByRole('button', { name: 'Mark Finished' });

    expect(finish).toHaveAttribute('aria-disabled', 'true');
    expect(finish).toHaveAccessibleDescription(
        'Own every expected volume before marking this collection Finished.',
    );
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
});

it('shows the condition for finishing on hover of the unavailable Mark Finished', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));
    show();
    const finish = await screen.findByRole('button', { name: 'Mark Finished' });

    await userEvent.hover(finish);

    expect(screen.getByRole('tooltip')).toHaveTextContent(
        'Own every expected volume before marking this collection Finished.',
    );
});

it('shows the condition for finishing when the unavailable Mark Finished has keyboard focus', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));
    show();
    const finish = await screen.findByRole('button', { name: 'Mark Finished' });

    finish.focus();

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
        'Own every expected volume before marking this collection Finished.',
    );
});

it('hides the condition for finishing on Escape', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));
    show();
    (await screen.findByRole('button', { name: 'Mark Finished' })).focus();

    await userEvent.keyboard('{Escape}');

    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
});

it('does not finish an incomplete collection when Mark Finished is clicked', async () => {
    const api = new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();
    const finish = await screen.findByRole('button', { name: 'Mark Finished' });

    await userEvent.click(finish);

    expect(api.calls.map((call) => call.route)).not.toContain('POST /collections/c1/finish');
});

it('shows no condition for finishing on a complete collection', async () => {
    new FakeApi().signedIn(account()).on('GET /collections/c1', () => ({
        status: 200,
        body: batman({ missingCount: 0, ownedCount: 3, expectedTo: 3, expectedCount: 3 }),
    }));
    show();
    const finish = await screen.findByRole('button', { name: 'Mark Finished' });

    await userEvent.hover(finish);

    expect(finish).not.toHaveAttribute('aria-disabled');
    expect(finish).not.toHaveAccessibleDescription();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
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

    expect(await screen.findByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Finished')).toHaveClass('collection-label--finished');
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

function wall() {
    return screen.getByRole('region', { name: /Choose the books to edit|books? chosen/ });
}

function drawer(name: string | RegExp) {
    return screen.getByRole('dialog', { name });
}

function cover(title: RegExp) {
    return screen.getByRole('button', { name: title });
}

function planned() {
    return screen.getByRole('list', { name: 'Planned changes' });
}

function leftOut() {
    return screen.getByRole('list', { name: 'Left out' });
}

async function chooseAllAndOpen() {
    await userEvent.click(await screen.findByRole('button', { name: 'Edit books' }));
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit 3 books' }));

    return drawer('Edit 3 books');
}

async function addChange(panel: HTMLElement, field: string) {
    await userEvent.click(within(panel).getByRole('button', { name: field }));

    return within(panel).getByRole('region', { name: field });
}

async function reviewTitles() {
    const panel = await chooseAllAndOpen();

    await addChange(panel, 'Titles');
    await userEvent.click(within(panel).getByRole('button', { name: 'Review changes' }));

    return screen.findByRole('dialog', { name: 'Review changes' });
}

it('offers a Guest no Edit books mode', async () => {
    new FakeApi().signedIn(account({ role: 'guest' })).on('GET /collections/c1', () => ({
        status: 200,
        body: batman(),
    }));

    show();

    await screen.findByRole('heading', { name: 'Batman' });
    expect(screen.queryByRole('button', { name: 'Edit books' })).not.toBeInTheDocument();
});

it('turns the covers into a selection in the Edit books mode', async () => {
    batchApi();
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Edit books' }));

    expect(
        within(wall())
            .getAllByRole('button')
            .map((tile) => tile.textContent),
    ).toEqual([
        'No coverBatman omnibusOwned · Omnibus 1–3',
        'No coverYear OneOwned',
        'No coverBatman 12Not owned',
    ]);
    expect(screen.getByText('0 of 3 books chosen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit 0 books' })).toBeDisabled();
    expect(screen.queryByRole('region', { name: 'Volumes' })).not.toBeInTheDocument();
});

it('keeps the missing volumes out of the selection', async () => {
    batchApi();
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit books' }));

    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));

    const missing = within(wall()).getByText('Volume 10').closest('li')!;

    expect(within(missing).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('3 of 3 books chosen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit 3 books' })).toBeEnabled();
});

it('adds a book to the selection by clicking its cover', async () => {
    batchApi();
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit books' }));

    await userEvent.click(cover(/^Year One/));

    expect(cover(/^Year One/)).toHaveAttribute('aria-pressed', 'true');
    expect(cover(/^Batman omnibus/)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('1 of 3 books chosen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit 1 book' })).toBeEnabled();
});

it('removes a chosen book by clicking its cover again', async () => {
    batchApi();
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit books' }));
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));

    await userEvent.click(cover(/^Batman 12/));

    expect(cover(/^Batman 12/)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Edit 2 books' })).toBeEnabled();
});

it('selects the owned books of the collection', async () => {
    batchApi();
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit books' }));

    await userEvent.click(screen.getByRole('button', { name: 'Select owned' }));

    expect(cover(/^Year One/)).toHaveAttribute('aria-pressed', 'true');
    expect(cover(/^Batman omnibus/)).toHaveAttribute('aria-pressed', 'true');
    expect(cover(/^Batman 12/)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Edit 2 books' })).toBeEnabled();
});

it('clears the selection', async () => {
    batchApi();
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit books' }));
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(
        within(wall())
            .getAllByRole('button')
            .map((tile) => tile.getAttribute('aria-pressed')),
    ).toEqual(['false', 'false', 'false']);
});

it('leaves the Edit books mode on Cancel', async () => {
    batchApi();
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit books' }));

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('region', { name: 'Volumes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit books' })).toBeInTheDocument();
});

it('opens a side drawer without a change, beside covers that stay clickable', async () => {
    batchApi();
    show();

    const panel = await chooseAllAndOpen();

    expect(panel).toHaveAttribute('aria-modal', 'false');
    expect(within(panel).getByText('No change yet')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Review changes' })).toBeDisabled();
    expect(screen.getByText('3 books chosen')).toBeInTheDocument();
    expect(cover(/^Batman 12/)).toBeEnabled();
});

it('updates the drawer when a cover is clicked while it is open', async () => {
    batchApi();
    show();
    await chooseAllAndOpen();

    await userEvent.click(cover(/^Batman 12/));

    expect(drawer('Edit 2 books')).toBeInTheDocument();
});

it('closes the drawer with Escape and goes back to the selection', async () => {
    batchApi();
    show();
    await chooseAllAndOpen();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit 3 books' })).toBeInTheDocument();
});

it('turns each added field into a card and stops offering it', async () => {
    batchApi();
    show();
    const panel = await chooseAllAndOpen();

    await userEvent.click(within(panel).getByRole('button', { name: 'Publisher' }));

    expect(
        within(screen.getByRole('region', { name: 'Publisher' })).getByRole('radio', {
            name: 'Set to',
        }),
    ).toBeChecked();
    expect(within(panel).queryByRole('button', { name: 'Publisher' })).not.toBeInTheDocument();
    expect(within(panel).getByText('1 change')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Review changes' })).toBeEnabled();
});

it('removes a change card and offers its field again', async () => {
    batchApi();
    show();
    const panel = await chooseAllAndOpen();
    const price = await addChange(panel, 'Price');

    await userEvent.click(within(price).getByRole('button', { name: 'Remove the change: Price' }));

    expect(within(panel).queryByRole('region', { name: 'Price' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Price' })).toBeInTheDocument();
    expect(within(panel).getByText('No change yet')).toBeInTheDocument();
});

it('sends only the changes added as cards', async () => {
    const api = batchApi();

    show();
    const panel = await chooseAllAndOpen();
    const publisher = await addChange(panel, 'Publisher');

    await userEvent.type(
        within(publisher).getByRole('textbox', { name: 'Publisher: new value' }),
        'DC Comics',
    );
    await userEvent.click(
        within(await addChange(panel, 'Price')).getByRole('radio', { name: 'Clear' }),
    );
    await addChange(panel, 'Titles');

    await userEvent.click(within(panel).getByRole('button', { name: 'Review changes' }));

    expect(api.calls.find((call) => call.route === 'POST /books/batch-edit')?.body).toEqual({
        collectionId: 'c1',
        bookIds: ['omnibus', 'year-one', 'twelve'],
        preview: true,
        changes: { publisher: 'DC Comics', price: null, generatedTitles: true },
    });
});

it('sends a publisher to fill only on the books that have none', async () => {
    const api = batchApi();

    show();
    const panel = await chooseAllAndOpen();
    const publisher = await addChange(panel, 'Publisher');

    await userEvent.click(within(publisher).getByRole('radio', { name: 'Fill if empty' }));
    await userEvent.type(
        within(publisher).getByRole('textbox', { name: 'Publisher: new value' }),
        'DC Comics',
    );

    await userEvent.click(within(panel).getByRole('button', { name: 'Review changes' }));

    expect(api.calls.find((call) => call.route === 'POST /books/batch-edit')?.body).toEqual({
        collectionId: 'c1',
        bookIds: ['omnibus', 'year-one', 'twelve'],
        preview: true,
        changes: { publisher: 'DC Comics', onlyIfEmpty: ['publisher'] },
    });
});

it('explains that Fill if empty only reaches the books without a value', async () => {
    batchApi();
    show();
    const panel = await chooseAllAndOpen();
    const price = await addChange(panel, 'Price');

    await userEvent.click(within(price).getByRole('radio', { name: 'Fill if empty' }));

    expect(within(price).getByText('Only the books without a price get it.')).toBeVisible();
    expect(within(price).getByRole('textbox', { name: 'Price: new value' })).toBeInTheDocument();
});

it('asks for the new category before reviewing', async () => {
    const api = batchApi();

    show();
    const panel = await chooseAllAndOpen();

    await addChange(panel, 'Category');

    await userEvent.click(within(panel).getByRole('button', { name: 'Review changes' }));

    expect(within(panel).getByText('Choose the new category.')).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).not.toContain('POST /books/batch-edit');
});

it('reviews the plan by change, with the books left out', async () => {
    batchApi();
    show();

    await reviewTitles();

    expect(within(planned()).getByText('Batman omnibus → Batman Vol. 1–3')).toBeInTheDocument();
    expect(within(planned()).getByText('→ none')).toBeInTheDocument();
    expect(within(planned()).getByText('Batman omnibus (€25.00)')).toBeInTheDocument();
    expect(within(planned()).getAllByText('The other book stays as it is.')).toHaveLength(2);
    expect(
        within(leftOut()).getByText(
            'Lent: cannot be set to Not owned. None of the changes apply to it.',
        ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save 1 book' })).toBeEnabled();
});

it('reviews the plan book by book', async () => {
    batchApi();
    show();
    const review = await reviewTitles();

    await userEvent.click(within(review).getByRole('radio', { name: 'Book' }));

    expect(
        within(planned()).getByText('Title: Batman omnibus → Batman Vol. 1–3'),
    ).toBeInTheDocument();
    expect(within(planned()).getByText('Price: €25.00 → none')).toBeInTheDocument();
    expect(within(planned()).getByText('Already as asked: no change')).toBeInTheDocument();
});

it('shows on each cover how many changes it gets or that it is left out', async () => {
    batchApi();
    show();

    await reviewTitles();

    expect(screen.getByText('1 book will change · 1 left out')).toBeInTheDocument();
    expect(cover(/^Batman omnibus/)).toHaveTextContent('2 changes');
    expect(cover(/^Year One/)).toHaveTextContent('No change');
    expect(cover(/^Batman 12/)).toHaveTextContent('Left out');
});

it('shows only the changes of a clicked cover', async () => {
    batchApi();
    show();
    const review = await reviewTitles();

    await userEvent.click(cover(/^Batman 12/));

    expect(within(review).getByText('Only the changes of Batman 12')).toBeInTheDocument();
    expect(within(review).queryByRole('list', { name: 'Planned changes' })).not.toBeInTheDocument();
    expect(within(review).getByRole('list', { name: 'Left out' })).toBeInTheDocument();
    expect(cover(/^Batman 12/)).toHaveAttribute('aria-pressed', 'true');
});

it('saves the batch, refreshes the collection and shows what was saved', async () => {
    const api = batchApi();

    show();
    const review = await reviewTitles();

    await userEvent.click(within(review).getByRole('button', { name: 'Save 1 book' }));

    expect(
        await screen.findByText(
            '1 book updated. Batman 12 was left out (Lent: cannot be set to Not owned).',
        ),
    ).toBeInTheDocument();
    expect(
        api.calls.filter((call) => call.route === 'POST /books/batch-edit').at(-1)?.body,
    ).toMatchObject({
        preview: false,
        changes: { generatedTitles: true },
    });
    expect(api.calls.filter((call) => call.route === 'GET /collections/c1')).toHaveLength(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Batman omnibus').closest('.wall-tile')).toHaveTextContent('Updated');
});

it('goes back to the collection covers once the saved batch is Done', async () => {
    batchApi();
    show();
    const review = await reviewTitles();

    await userEvent.click(within(review).getByRole('button', { name: 'Save 1 book' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Done' }));

    expect(screen.getByRole('region', { name: 'Volumes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit books' })).toBeInTheDocument();
});

it('asks once which author is meant and plans again with the chosen one', async () => {
    let attempts = 0;
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /collections/c1', () => ({ status: 200, body: batman() }))
        .on('POST /books/batch-edit', () =>
            ++attempts === 1
                ? {
                      status: 409,
                      body: {
                          code: 'conflict',
                          reason: 'author-similar',
                          message: 'Similar',
                          details: {
                              name: 'Bob Kane',
                              candidates: [{ id: 'a7', name: 'Bob Kane Jr' }],
                          },
                      },
                  }
                : {
                      status: 200,
                      body: {
                          collection: { id: 'c1', name: 'Batman' },
                          saved: false,
                          books: [],
                          skipped: [],
                      },
                  },
        );

    show();
    const panel = await chooseAllAndOpen();
    const authors = await addChange(panel, 'Authors');

    await userEvent.type(within(authors).getByRole('combobox', { name: 'Add author' }), 'Bob Kane');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(within(panel).getByRole('button', { name: 'Review changes' }));
    const question = await screen.findByRole('dialog', { name: 'Use an existing author?' });

    await userEvent.click(within(question).getByRole('button', { name: 'Use Bob Kane Jr' }));

    await vi.waitFor(() =>
        expect(
            api.calls.filter((call) => call.route === 'POST /books/batch-edit')[1]?.body,
        ).toMatchObject({ preview: true, changes: { authors: [{ id: 'a7' }] } }),
    );
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

    const toggle = await screen.findByRole('button', { name: 'Mark all read' });

    expect(toggle).not.toHaveClass('button--pressed');
    expect(
        screen.getByText(
            'Applies to the 3 owned books of this collection. This does not change another account’s status.',
        ),
    ).toBeInTheDocument();
});

it('hides the reading panel while books are being edited together', async () => {
    reading(false);
    show();
    await screen.findByRole('button', { name: 'Mark all read' });

    await userEvent.click(screen.getByRole('button', { name: 'Edit books' }));

    expect(screen.queryByText('Only your reading')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit books' })).not.toBeInTheDocument();
});

it('shows Read pressed once every owned book is read', async () => {
    reading(true, 1);

    show();

    expect(await screen.findByRole('button', { name: 'All read' })).toHaveClass('button--pressed');
    expect(screen.getByText(/^Applies to the owned book of this collection\./)).toBeInTheDocument();
});

it('offers no reading status for a collection without owned books', async () => {
    reading(false, 0);

    show();

    await screen.findByRole('heading', { name: 'Batman' });
    await waitFor(() => expect(screen.queryByText('Only your reading')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument();
});

it('marks every owned book read at once, without confirmation', async () => {
    const api = reading(false).on('PUT /collections/c1/reading', () => ({
        status: 200,
        body: { read: true, ownedCount: 3 },
    }));

    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));

    expect(await screen.findByRole('button', { name: 'All read' })).toHaveClass('button--pressed');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls).toContainEqual({
        route: 'PUT /collections/c1/reading',
        body: { read: true },
    });
});

it('asks before marking the whole collection not read', async () => {
    const api = reading(true);

    show();

    await userEvent.click(await screen.findByRole('button', { name: 'All read' }));

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
    await userEvent.click(await screen.findByRole('button', { name: 'All read' }));
    const dialog = screen.getByRole('dialog', { name: 'Mark the whole collection as not read?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All read' })).toHaveClass('button--pressed');
    expect(api.calls.map((call) => call.route)).not.toContain('PUT /collections/c1/reading');
});

it('marks every owned book not read once confirmed', async () => {
    const api = reading(true).on('PUT /collections/c1/reading', () => ({
        status: 200,
        body: { read: false, ownedCount: 3 },
    }));

    show();
    await userEvent.click(await screen.findByRole('button', { name: 'All read' }));
    const dialog = screen.getByRole('dialog', { name: 'Mark the whole collection as not read?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as not read' }));

    expect(await screen.findByRole('button', { name: 'Mark all read' })).not.toHaveClass(
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
