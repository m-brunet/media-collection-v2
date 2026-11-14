import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
    CollectionDetailsDto,
    MissingVolumeEditionDto,
    MissingVolumesDto,
} from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { Required } from '../../shared/required.util';
import { CollectionDetailsPage } from './collection-details-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const gunnm: CollectionDetailsDto = {
    id: 'c1',
    name: 'Gunnm',
    category: 'manga',
    includesVolumeZero: false,
    finished: false,
    bookCount: 1,
    expectedFrom: 1,
    expectedTo: 1,
    expectedCount: 1,
    ownedCount: 1,
    missingCount: 0,
    lastOwned: 1,
    previews: [],
    volumes: [
        {
            from: 1,
            to: 1,
            state: 'owned',
            books: [
                {
                    id: 'book-1',
                    title: 'Gunnm Vol. 1',
                    isbn: '9782723432931',
                    publisher: 'Glénat',
                    category: 'manga',
                    ownership: 'owned',
                    hasCover: false,
                    updatedAt: '2026-01-01T00:00:00.000Z',
                    volumeFrom: 1,
                    volumeTo: 1,
                },
            ],
        },
    ],
};

function edition(
    isbn13: string,
    changes: Partial<MissingVolumeEditionDto> = {},
): MissingVolumeEditionDto {
    return {
        isbn13,
        title: null,
        subtitle: null,
        authors: ['Yukito Kishiro'],
        publisher: 'Glénat',
        publicationYear: 2001,
        pageCount: 200,
        summary: null,
        inLibrary: false,
        ...changes,
    };
}

const found: MissingVolumesDto = {
    kind: 'found',
    collection: { id: 'c1', name: 'Gunnm', category: 'manga' },
    anchor: { bookId: 'book-1', volume: 1 },
    series: 'Gunnm',
    rows: [
        {
            volume: 2,
            generatedTitle: 'Gunnm Vol. 2',
            editions: [
                edition('9782723434324', { title: 'La vierge de fer' }),
                edition('9782344017524', { publicationYear: 2017 }),
            ],
        },
        { volume: 3, generatedTitle: 'Gunnm Vol. 3', editions: [] },
        {
            volume: 4,
            generatedTitle: 'Gunnm Vol. 4',
            editions: [edition('9782723434782', { inLibrary: true })],
        },
    ],
};

function library(search: MissingVolumesDto = found) {
    return new FakeApi()
        .signedIn(account())
        .on('GET /collections/c1', () => ({ status: 200, body: gunnm }))
        .on('GET /collections/c1/reading', () => ({
            status: 200,
            body: { read: false, ownedCount: 1 },
        }))
        .on('POST /collections/c1/missing-volumes/search', () => ({ status: 200, body: search }))
        .on('POST /books/lookups/volume-cover', () => ({ status: 200, body: { kind: 'none' } }));
}

async function review(api = library()) {
    renderRoute('/collections/c1', { '/collections/:id': <CollectionDetailsPage /> });
    await userEvent.click(await screen.findByRole('button', { name: 'Add volumes up to…' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: /Up to volume/ }), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Find volumes' }));
    await screen.findByRole('region', { name: 'Volumes to add' });

    return api;
}

function rowOf(volume: number) {
    return Required.value(
        screen
            .getAllByRole('row')
            .find((row) => within(row).queryByRole('checkbox', { name: 'Add volume ' + volume })),
        'volume ' + volume + ' has a row',
    );
}

it('looks up the missing volumes up to the number asked', async () => {
    const api = await review();

    expect(api.calls).toContainEqual({
        route: 'POST /collections/c1/missing-volumes/search',
        body: { upTo: 4 },
    });
});

it('ticks each volume found, on its best edition, with its generated title', async () => {
    await review();

    expect(within(rowOf(2)).getByRole('checkbox')).toBeChecked();
    expect(within(rowOf(2)).getByText('Gunnm Vol. 2')).toBeVisible();
    expect(within(rowOf(2)).getByRole('combobox', { name: 'Edition of volume 2' })).toHaveValue(
        '9782723434324',
    );
});

it('shows a volume not found and a volume already in the library without a tick', async () => {
    await review();

    expect(within(rowOf(3)).getByText('Not found in the BnF catalogue')).toBeVisible();
    expect(within(rowOf(3)).getByRole('checkbox')).toBeDisabled();
    expect(within(rowOf(4)).getByText('Already in your library')).toBeVisible();
    expect(within(rowOf(4)).getByRole('checkbox')).not.toBeChecked();
});

it("offers the BnF's title as a suggestion", async () => {
    await review();

    await userEvent.click(within(rowOf(2)).getByRole('button', { name: 'Use as title' }));

    expect(within(rowOf(2)).getByText('La vierge de fer')).toBeVisible();
    expect(within(rowOf(2)).getByRole('button', { name: 'Use Gunnm Vol. 2' })).toBeVisible();
});

it('shows the cover of a volume once it arrives', async () => {
    const api = library().on('POST /books/lookups/volume-cover', () => ({
        status: 200,
        body: { kind: 'found', token: 'token-2' },
    }));

    await review(api);

    expect(await screen.findByRole('img', { name: 'Cover of volume 2' })).toHaveAttribute(
        'src',
        '/api/books/lookups/covers/token-2',
    );
});

it('adds the ticked volumes with their edition, ownership and title, then reports', async () => {
    const api = library().on('POST /books/volumes', () => ({
        status: 201,
        body: {
            added: [{ bookId: 'book-2', volume: 2, title: 'Gunnm Vol. 2' }],
            skipped: [],
        },
    }));

    await review(api);
    await userEvent.selectOptions(
        within(rowOf(2)).getByRole('combobox', { name: 'Edition of volume 2' }),
        '9782344017524',
    );
    await userEvent.selectOptions(
        within(rowOf(2)).getByRole('combobox', { name: 'Ownership of volume 2' }),
        'not-owned',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add 1 volume' }));

    expect(await screen.findByText('A volume was added to Gunnm.')).toBeVisible();
    expect(api.calls).toContainEqual({
        route: 'POST /books/volumes',
        body: {
            collectionId: 'c1',
            anchorBookId: 'book-1',
            volumes: [
                {
                    volume: 2,
                    isbn: '9782344017524',
                    ownership: 'not-owned',
                    title: null,
                    authors: ['Yukito Kishiro'],
                    publicationYear: 2017,
                    pageCount: 200,
                    summary: null,
                },
            ],
        },
    });
    expect(screen.queryByRole('region', { name: 'Volumes to add' })).not.toBeInTheDocument();
});

it('saves the cover that arrived with its volume', async () => {
    const api = library()
        .on('POST /books/lookups/volume-cover', () => ({
            status: 200,
            body: { kind: 'found', token: 'token-2' },
        }))
        .on('GET /books/lookups/covers/token-2', () => ({
            status: 200,
            body: new Blob([new Uint8Array([0xff, 0xd8])], { type: 'image/jpeg' }),
        }))
        .on('POST /books/volumes', () => ({
            status: 201,
            body: { added: [{ bookId: 'book-2', volume: 2, title: 'Gunnm Vol. 2' }], skipped: [] },
        }))
        .on('PUT /books/book-2/cover', () => ({ status: 200, body: {} }));

    await review(api);
    await screen.findByRole('img', { name: 'Cover of volume 2' });

    await userEvent.click(screen.getByRole('button', { name: 'Add 1 volume' }));

    await screen.findByText('A volume was added to Gunnm.');
    expect(api.calls.map((call) => call.route)).toContain('PUT /books/book-2/cover');
});

function stubPreviews() {
    vi.stubGlobal(
        'URL',
        Object.assign(URL, { createObjectURL: () => 'blob:cover', revokeObjectURL: () => {} }),
    );
}

const picked = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'cover.jpg', { type: 'image/jpeg' });

async function pickCover(volume: number) {
    await userEvent.click(
        await within(rowOf(volume)).findByRole('button', {
            name: 'Find a cover for volume ' + volume,
        }),
    );
    await userEvent.upload(
        Required.value(
            screen.getByRole('dialog').querySelector<HTMLInputElement>('input[type="file"]'),
            'the cover picker has a file input',
        ),
        picked,
    );
}

it('offers a web search by ISBN for a volume without a cover', async () => {
    await review();

    await userEvent.click(
        await within(rowOf(2)).findByRole('button', { name: 'Find a cover for volume 2' }),
    );

    expect(
        within(screen.getByRole('dialog')).getByRole('link', {
            name: /Search this cover on the web/,
        }),
    ).toHaveAttribute('href', 'https://www.google.com/search?tbm=isch&q=9782723434324');
});

it('shows the cover picked for a volume in its row', async () => {
    stubPreviews();
    await review();

    await pickCover(2);

    expect(within(rowOf(2)).getByRole('img', { name: 'Cover of volume 2' })).toHaveAttribute(
        'src',
        'blob:cover',
    );
});

it('saves the cover picked for a volume', async () => {
    stubPreviews();
    const api = library()
        .on('POST /books/volumes', () => ({
            status: 201,
            body: { added: [{ bookId: 'book-2', volume: 2, title: 'Gunnm Vol. 2' }], skipped: [] },
        }))
        .on('PUT /books/book-2/cover', () => ({ status: 200, body: {} }));

    await review(api);
    await pickCover(2);

    await userEvent.click(screen.getByRole('button', { name: 'Add 1 volume' }));

    await screen.findByText('A volume was added to Gunnm.');
    expect(api.calls.find((call) => call.route === 'PUT /books/book-2/cover')?.body).toBe(picked);
});

it('closes the report of the volumes added', async () => {
    const api = library().on('POST /books/volumes', () => ({
        status: 201,
        body: { added: [{ bookId: 'book-2', volume: 2, title: 'Gunnm Vol. 2' }], skipped: [] },
    }));

    await review(api);
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 volume' }));
    await screen.findByText('A volume was added to Gunnm.');

    await userEvent.click(screen.getByRole('button', { name: 'Close message' }));

    expect(screen.queryByText('A volume was added to Gunnm.')).not.toBeInTheDocument();
});

it('reports a volume left out at save time', async () => {
    const api = library().on('POST /books/volumes', () => ({
        status: 201,
        body: {
            added: [],
            skipped: [{ volume: 2, isbn: '9782723434324', reason: 'isbn-taken' }],
        },
    }));

    await review(api);

    await userEvent.click(screen.getByRole('button', { name: 'Add 1 volume' }));

    expect(
        await screen.findByText(
            'No volume was added to Gunnm. Volume 2 was left out: this ISBN is already in your library.',
        ),
    ).toBeVisible();
});

it('adds nothing when the review is cancelled', async () => {
    const api = await review();

    await userEvent.click(
        within(screen.getByRole('region')).getByRole('button', {
            name: 'Cancel',
        }),
    );

    expect(screen.queryByRole('region', { name: 'Volumes to add' })).not.toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).not.toContain('POST /books/volumes');
});

it('explains that the edition is not in the BnF catalogue', async () => {
    library({ kind: 'edition-not-found' });
    renderRoute('/collections/c1', { '/collections/:id': <CollectionDetailsPage /> });
    await userEvent.click(await screen.findByRole('button', { name: 'Add volumes up to…' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: /Up to volume/ }), '4');

    await userEvent.click(screen.getByRole('button', { name: 'Find volumes' }));

    expect(
        await screen.findByText(
            'The edition of this collection was not found in the BnF catalogue. Nothing was added.',
        ),
    ).toBeVisible();
});

it('offers a Guest no way to add volumes', async () => {
    library().signedIn(account({ role: 'guest' }));

    renderRoute('/collections/c1', { '/collections/:id': <CollectionDetailsPage /> });

    await screen.findByRole('heading', { name: 'Gunnm' });
    expect(screen.queryByRole('button', { name: 'Add volumes up to…' })).not.toBeInTheDocument();
});
