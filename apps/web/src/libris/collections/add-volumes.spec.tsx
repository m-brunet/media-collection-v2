import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
    CollectionDetailsDto,
    MissingVolumeEditionDto,
    MissingVolumesDto,
    NewVolumesDto,
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
    status: 'unfinished',
    lastVolume: null,
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
        publishers: ['Glénat'],
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
    catalogues: ['bnf'],
    unavailable: [],
    rows: [
        {
            volume: 2,
            source: 'bnf',
            generatedTitle: 'Gunnm Vol. 2',
            editions: [
                edition('9782723434324', { title: 'La vierge de fer' }),
                edition('9782344017524', { publicationYear: 2017 }),
            ],
        },
        { volume: 3, source: null, generatedTitle: 'Gunnm Vol. 3', editions: [] },
        {
            volume: 4,
            source: 'bnf',
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
    await userEvent.click(await screen.findByRole('button', { name: 'Add volumes' }));
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

it('starts at the last volume of the collection when it has one', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /collections/c1', () => ({ status: 200, body: { ...gunnm, lastVolume: 15 } }))
        .on('GET /collections/c1/reading', () => ({
            status: 200,
            body: { read: false, ownedCount: 1 },
        }));
    renderRoute('/collections/c1', { '/collections/:id': <CollectionDetailsPage /> });

    await userEvent.click(await screen.findByRole('button', { name: 'Add volumes' }));

    expect(screen.getByRole('spinbutton', { name: /Up to volume/ })).toHaveValue(15);
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

    expect(within(rowOf(3)).getByText('Not found in the BnF or Sudoc catalogues')).toBeVisible();
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

it('shows the cover of a volume once its picture has arrived', async () => {
    const api = library()
        .on('POST /books/lookups/volume-cover', () => ({
            status: 200,
            body: { kind: 'found', token: 'token-2' },
        }))
        .on('GET /books/lookups/covers/token-2', () => ({
            status: 200,
            body: new Blob(['cover'], { type: 'image/jpeg' }),
        }));

    await review(api);

    expect(await screen.findByRole('img', { name: 'Cover of volume 2' })).toHaveAttribute(
        'src',
        '/api/books/lookups/covers/token-2',
    );
});

it('shows no cover for a volume whose picture could not be downloaded', async () => {
    const api = library()
        .on('POST /books/lookups/volume-cover', () => ({
            status: 200,
            body: { kind: 'found', token: 'token-2' },
        }))
        .on('GET /books/lookups/covers/token-2', () => ({ status: 404 }));

    await review(api);
    await vi.waitFor(() =>
        expect(api.calls.map((call) => call.route)).toContain('GET /books/lookups/covers/token-2'),
    );

    expect(screen.queryByRole('img', { name: 'Cover of volume 2' })).not.toBeInTheDocument();
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
                    publisher: 'Glénat',
                    publicationYear: 2017,
                    pageCount: 200,
                    summary: null,
                },
            ],
        },
    });
    expect(screen.queryByRole('region', { name: 'Volumes to add' })).not.toBeInTheDocument();
});

const publishing: MissingVolumesDto = {
    ...found,
    rows: [
        {
            volume: 2,
            source: 'bnf',
            generatedTitle: 'Gunnm Vol. 2',
            editions: [edition('9782723434324', { publishers: ['Glénat', 'Seinen manga'] })],
        },
        {
            volume: 3,
            source: 'bnf',
            generatedTitle: 'Gunnm Vol. 3',
            editions: [edition('9782723434775', { publishers: ['Kana'] })],
        },
        {
            volume: 4,
            source: 'bnf',
            generatedTitle: 'Gunnm Vol. 4',
            editions: [edition('9782723434782', { publishers: [] })],
        },
    ],
};

function publisherOf(volume: number) {
    return within(rowOf(volume)).getByRole('combobox', { name: 'Publisher of volume ' + volume });
}

it("keeps each volume's own publisher, even when they differ", async () => {
    await review(library(publishing));

    const shown = [
        publisherOf(2),
        within(rowOf(3)).getByText('Kana'),
        within(rowOf(4)).getByText('As volume 1'),
    ];

    expect(shown[0]).toHaveValue('Glénat');
    expect(shown.slice(1)).toHaveLength(2);
});

it('gives every volume one publisher, then lets one volume keep another', async () => {
    const api = library(publishing).on('POST /books/volumes', () => ({
        status: 201,
        body: { added: [], skipped: [] },
    }));

    await review(api);
    await userEvent.selectOptions(
        screen.getByRole('combobox', { name: 'Publisher of every volume' }),
        'Seinen manga',
    );
    await userEvent.selectOptions(publisherOf(3), 'Kana');

    await userEvent.click(screen.getByRole('button', { name: 'Add 3 volumes' }));

    const sent = await vi.waitFor(() =>
        Required.value(
            api.calls.find((call) => call.route === 'POST /books/volumes'),
            'the volumes were sent',
        ),
    );

    expect((sent.body as NewVolumesDto).volumes.map((volume) => volume.publisher)).toEqual([
        'Seinen manga',
        'Kana',
        'Seinen manga',
    ]);
});

it('gives each volume its own publisher again from the every-volume choice', async () => {
    await review(library(publishing));
    const every = screen.getByRole('combobox', { name: 'Publisher of every volume' });

    await userEvent.selectOptions(every, 'Seinen manga');

    await userEvent.selectOptions(every, "Each volume's own");

    expect([publisherOf(2), within(rowOf(3)).getByText('Kana')]).toEqual([
        expect.objectContaining({ value: 'Glénat' }),
        expect.anything(),
    ]);
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

it('explains that the edition is in neither catalogue', async () => {
    library({ kind: 'edition-not-found' });
    renderRoute('/collections/c1', { '/collections/:id': <CollectionDetailsPage /> });
    await userEvent.click(await screen.findByRole('button', { name: 'Add volumes' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: /Up to volume/ }), '4');

    await userEvent.click(screen.getByRole('button', { name: 'Find volumes' }));

    expect(
        await screen.findByText(
            'The edition of this collection was not found in the BnF or Sudoc catalogues. Nothing was added.',
        ),
    ).toBeVisible();
});

async function searched(answer: MissingVolumesDto) {
    library(answer);
    renderRoute('/collections/c1', { '/collections/:id': <CollectionDetailsPage /> });
    await userEvent.click(await screen.findByRole('button', { name: 'Add volumes' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: /Up to volume/ }), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Find volumes' }));
}

it('names the catalogue that cannot be reached', async () => {
    await searched({ kind: 'unavailable', catalogues: ['sudoc'], retryAt: null });

    expect(
        await screen.findByText(
            'The Sudoc catalogue cannot be reached right now. Try again in a few minutes.',
        ),
    ).toBeVisible();
});

it('names both catalogues when neither can be reached', async () => {
    await searched({ kind: 'unavailable', catalogues: ['bnf', 'sudoc'], retryAt: null });

    expect(
        await screen.findByText(
            'The BnF and Sudoc catalogues cannot be reached right now. Try again in a few minutes.',
        ),
    ).toBeVisible();
});

it('names the BnF as the catalogue the volumes come from, and credits it', async () => {
    await searched(found);

    const panel = await screen.findByRole('region', { name: 'Volumes to add' });

    expect(
        within(panel).getByText(/^Found in the BnF catalogue from the edition of volume 1\./),
    ).toBeVisible();
    expect(within(panel).getByText('Source: BnF catalogue (Licence Ouverte).')).toBeVisible();
});

it('names the Sudoc alone when only it answered', async () => {
    await searched({ ...found, catalogues: ['sudoc'] });

    const panel = await screen.findByRole('region', { name: 'Volumes to add' });

    expect(
        within(panel).getByText(/^Found in the Sudoc catalogue from the edition of volume 1\./),
    ).toBeVisible();
    expect(within(panel).getByText('Source: Sudoc catalogue (Licence Ouverte).')).toBeVisible();
});

it('names both catalogues when both contributed, and credits both', async () => {
    await searched({ ...found, catalogues: ['bnf', 'sudoc'] });

    const panel = await screen.findByRole('region', { name: 'Volumes to add' });

    expect(
        within(panel).getByText(
            /^Found in the BnF and Sudoc catalogues from the edition of volume 1\./,
        ),
    ).toBeVisible();
    expect(
        within(panel).getByText('Sources: BnF and Sudoc catalogues (Licence Ouverte).'),
    ).toBeVisible();
});

it('warns that volumes may be missing when a catalogue could not answer', async () => {
    await searched({ ...found, unavailable: ['sudoc'] });

    expect(
        await screen.findByText(
            'The Sudoc catalogue could not answer, so volumes may be missing from this list.',
        ),
    ).toBeVisible();
});

it("says which catalogue suggests a volume's title", async () => {
    await searched({
        ...found,
        rows: found.kind === 'found' ? found.rows.map((row) => ({ ...row, source: 'sudoc' })) : [],
    });

    expect(await screen.findByText('Sudoc suggests: La vierge de fer')).toBeVisible();
});

it('cancels the volume search when its dialog is closed', async () => {
    const api = library({ kind: 'edition-not-found' });

    renderRoute('/collections/c1', { '/collections/:id': <CollectionDetailsPage /> });
    await userEvent.click(await screen.findByRole('button', { name: 'Add volumes' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: /Up to volume/ }), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Find volumes' }));
    await screen.findByText(/was not found in the BnF or Sudoc catalogues/);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(api.signals.get('POST /collections/c1/missing-volumes/search')?.aborted).toBe(true);
});

it('offers a Guest no way to add volumes', async () => {
    library().signedIn(account({ role: 'guest' }));

    renderRoute('/collections/c1', { '/collections/:id': <CollectionDetailsPage /> });

    await screen.findByRole('heading', { name: 'Gunnm' });
    expect(screen.queryByRole('button', { name: 'Add volumes' })).not.toBeInTheDocument();
});
