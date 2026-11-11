import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookLookupDto } from '../../../../../packages/contracts/src/http';
import { bookDto } from '../../testing/book-fixtures.test-support';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { BookFormPage } from './book-form-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function addPage() {
    return renderRoute('/books/new', {
        '/books/new': <BookFormPage />,
        '/books/:id/edit': <BookFormPage />,
    });
}

function editPage() {
    return renderRoute('/books/b1/edit', { '/books/:id/edit': <BookFormPage /> });
}

async function fillRequired() {
    await userEvent.type(await screen.findByLabelText(/^ISBN/), '0-306-40615-2');
    await userEvent.type(screen.getByLabelText(/^Title/), 'Piranesi');
    await userEvent.type(screen.getByRole('combobox', { name: 'Add author' }), 'Susanna Clarke');
    await userEvent.keyboard('{Enter}');
}

function saveButton() {
    return screen.getAllByRole('button', { name: 'Save book' })[0]!;
}

it('opens with additional information collapsed and the cover control visible', async () => {
    new FakeApi().signedIn(account());

    addPage();

    expect(
        await screen.findByRole('button', { name: '03 / Additional information' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Publisher')).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose cover' })).toBeInTheDocument();
    expect(screen.getByText('No cover selected')).toBeInTheDocument();
});

it('saves a new book with a typed author and opens the confirmation', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('POST /books', () => ({ status: 201, body: bookDto() }));
    const router = addPage();

    await fillRequired();

    await userEvent.click(saveButton());

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/books/b1/added'));
    expect(api.calls.find((call) => call.route === 'POST /books')?.body).toMatchObject({
        title: 'Piranesi',
        isbn: '0-306-40615-2',
        authors: [{ name: 'Susanna Clarke' }],
        ownership: 'owned',
        read: false,
    });
});

it('suggests existing authors while typing', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /authors', () => ({ status: 200, body: [{ id: 'a1', name: 'Hervé Bazin' }] }))
        .on('POST /books', () => ({ status: 201, body: bookDto() }));

    addPage();
    await userEvent.type(await screen.findByRole('combobox', { name: 'Add author' }), 'herv');

    await userEvent.click(await screen.findByRole('option', { name: 'Hervé Bazin' }));
    await userEvent.type(screen.getByLabelText(/^Title/), 'Vipère au poing');
    await userEvent.click(screen.getByLabelText('This book has no ISBN'));
    await userEvent.click(saveButton());

    await vi.waitFor(() =>
        expect(api.calls.find((call) => call.route === 'POST /books')?.body).toMatchObject({
            authors: [{ id: 'a1' }],
            isbn: null,
            noIsbn: true,
        }),
    );
});

it('keeps the draft and explains a refused save beside the field', async () => {
    new FakeApi().signedIn(account()).on('POST /books', () => ({
        status: 400,
        body: { code: 'invalid_input', reason: 'isbn-invalid', message: 'Invalid' },
    }));

    addPage();
    await fillRequired();

    await userEvent.click(saveButton());

    expect(await screen.findByLabelText(/^ISBN/)).toHaveAccessibleDescription(
        expect.stringContaining('This ISBN is not valid. Check its digits.'),
    );
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Piranesi');
});

it('offers to open the book that already has this ISBN', async () => {
    new FakeApi().signedIn(account()).on('POST /books', () => ({
        status: 409,
        body: {
            code: 'conflict',
            reason: 'isbn-taken',
            message: 'Taken',
            details: { bookId: 'b9' },
        },
    }));

    addPage();
    await fillRequired();

    await userEvent.click(saveButton());

    expect(await screen.findByRole('link', { name: 'Open the existing book' })).toHaveAttribute(
        'href',
        '/books/b9',
    );
});

it('asks whether a similar author is the same person and reuses the chosen one', async () => {
    let attempts = 0;
    const api = new FakeApi().signedIn(account()).on('POST /books', () =>
        ++attempts === 1
            ? {
                  status: 409,
                  body: {
                      code: 'conflict',
                      reason: 'author-similar',
                      message: 'Similar',
                      details: {
                          name: 'Susanna Clarke',
                          candidates: [{ id: 'a7', name: 'Susana Clarke' }],
                      },
                  },
              }
            : { status: 201, body: bookDto() },
    );

    addPage();
    await fillRequired();
    await userEvent.click(saveButton());
    const dialog = await screen.findByRole('dialog', { name: 'Use an existing author?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Use Susana Clarke' }));

    await vi.waitFor(() =>
        expect(api.calls.filter((call) => call.route === 'POST /books')[1]?.body).toMatchObject({
            authors: [{ id: 'a7' }],
        }),
    );
});

it('creates a different author once the person confirms it', async () => {
    let attempts = 0;
    const api = new FakeApi().signedIn(account()).on('POST /books', () =>
        ++attempts === 1
            ? {
                  status: 409,
                  body: {
                      code: 'conflict',
                      reason: 'author-similar',
                      message: 'Similar',
                      details: {
                          name: 'Susanna Clarke',
                          candidates: [{ id: 'a7', name: 'Susana Clarke' }],
                      },
                  },
              }
            : { status: 201, body: bookDto() },
    );

    addPage();
    await fillRequired();
    await userEvent.click(saveButton());

    await userEvent.click(
        await screen.findByRole('button', {
            name: 'Create “Susanna Clarke” as a different author',
        }),
    );

    await vi.waitFor(() =>
        expect(api.calls.filter((call) => call.route === 'POST /books')[1]?.body).toMatchObject({
            authors: [{ name: 'Susanna Clarke', distinct: true }],
        }),
    );
});

it('warns about a possible duplicate and continues with a distinct edition', async () => {
    let attempts = 0;
    const api = new FakeApi().signedIn(account()).on('POST /books', () =>
        ++attempts === 1
            ? {
                  status: 409,
                  body: {
                      code: 'conflict',
                      reason: 'possible-duplicate',
                      message: 'Duplicate',
                      details: {
                          candidates: [
                              { id: 'b9', title: 'Piranesi', authors: ['Susanna Clarke'] },
                          ],
                      },
                  },
              }
            : { status: 201, body: bookDto() },
    );

    addPage();
    await fillRequired();
    await userEvent.click(saveButton());
    const dialog = await screen.findByRole('dialog', { name: 'This book may already exist' });

    await userEvent.click(
        within(dialog).getByRole('button', { name: 'Continue with this edition' }),
    );

    await vi.waitFor(() =>
        expect(api.calls.filter((call) => call.route === 'POST /books')[1]?.body).toMatchObject({
            confirmDistinct: true,
        }),
    );
});

it('asks before leaving with unsaved changes', async () => {
    new FakeApi().signedIn(account());

    addPage();
    await userEvent.type(await screen.findByLabelText(/^Title/), 'Draft');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
        await screen.findByRole('dialog', { name: 'Discard your changes?' }),
    ).toBeInTheDocument();
});

it('keeps editing when the person chooses so', async () => {
    new FakeApi().signedIn(account());

    const router = addPage();

    await userEvent.type(await screen.findByLabelText(/^Title/), 'Draft');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Keep editing' }));

    expect(router.state.location.pathname).toBe('/books/new');
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Draft');
});

it('leaves without asking when nothing changed', async () => {
    new FakeApi().signedIn(account());

    addPage();
    await screen.findByLabelText(/^Title/);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Elsewhere: /books')).toBeInTheDocument();
});

it('shows an existing note directly when additional information is opened', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({
        status: 200,
        body: bookDto({
            personal: { read: true, note: { text: 'Mine.', updatedAt: '2026-01-01T00:00:00Z' } },
        }),
    }));

    editPage();

    await userEvent.click(
        await screen.findByRole('button', { name: '03 / Additional information' }),
    );

    expect(screen.getByLabelText(/Personal note/)).toHaveValue('Mine.');
    expect(screen.queryByRole('button', { name: 'Add a personal note' })).not.toBeInTheDocument();
});

it('saves changes and the reading status of the viewer', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /books/b1', () => ({ status: 200, body: bookDto() }))
        .on('PUT /books/b1', () => ({ status: 200, body: bookDto({ title: 'Piranesi (2)' }) }))
        .on('PUT /books/b1/reading', () => ({ status: 200, body: { read: true } }));
    const router = editPage();

    await userEvent.clear(await screen.findByLabelText(/^Title/));
    await userEvent.type(screen.getByLabelText(/^Title/), 'Piranesi (2)');
    await userEvent.click(screen.getByRole('button', { name: 'Read' }));

    await userEvent.click(screen.getAllByRole('button', { name: 'Save changes' })[0]!);

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/books/b1'));
    expect(api.calls).toContainEqual({ route: 'PUT /books/b1/reading', body: { read: true } });
});

it('uploads the chosen cover after saving', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('POST /books', () => ({ status: 201, body: bookDto() }))
        .on('PUT /books/b1/cover', () => ({ status: 200, body: bookDto({ hasCover: true }) }));
    const image = new File([new Uint8Array([1, 2, 3])], 'cover.png', { type: 'image/png' });

    vi.stubGlobal(
        'URL',
        Object.assign(URL, { createObjectURL: () => 'blob:cover', revokeObjectURL: () => {} }),
    );
    addPage();
    await fillRequired();
    await userEvent.upload(document.querySelector('input[type="file"]')!, image);

    await userEvent.click(saveButton());

    await vi.waitFor(() =>
        expect(api.calls.find((call) => call.route === 'PUT /books/b1/cover')?.body).toBe(image),
    );
});

it('refuses a cover that is not a supported image without contacting the server', async () => {
    new FakeApi().signedIn(account());
    const image = new File(['GIF89a'], 'cover.gif', { type: 'image/gif' });

    addPage();
    await screen.findByLabelText(/^Title/);

    await userEvent.upload(document.querySelector('input[type="file"]')!, image, {
        applyAccept: false,
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPEG, PNG or WebP image.');
});

it('corrects the shared spelling of a saved author after confirmation', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /books/b1', () => ({ status: 200, body: bookDto() }))
        .on('PUT /authors/a1', () => ({ status: 200, body: { id: 'a1', name: 'Susanna Clarke' } }));

    editPage();
    await userEvent.click(
        await screen.findByRole('button', { name: 'Correct the spelling of Susanna Clarke' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Correct the shared author name?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm correction' }));

    expect(
        await screen.findByText('Author name corrected on every linked book.'),
    ).toBeInTheDocument();
    expect(api.calls).toContainEqual({
        route: 'PUT /authors/a1',
        body: { name: 'Susanna Clarke' },
    });
});

async function joinCollection(name: string, volume: string) {
    await userEvent.click(screen.getByRole('checkbox', { name: 'Part of a collection' }));
    await userEvent.type(screen.getByRole('combobox', { name: /Collection name/ }), name);
    await userEvent.type(screen.getByRole('textbox', { name: /Volume number/ }), volume);
}

function posted(api: FakeApi) {
    return api.calls.filter((call) => call.route === 'POST /books').map((call) => call.body);
}

it('saves a book with its collection and volume', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('POST /books', () => ({ status: 201, body: bookDto() }));

    addPage();
    await fillRequired();
    await joinCollection('Batman', '3');

    await userEvent.click(saveButton());

    await vi.waitFor(() =>
        expect(posted(api)[0]).toMatchObject({
            collection: { collection: { name: 'Batman' }, volumeFrom: 3, volumeTo: 3 },
        }),
    );
});

it('saves an omnibus range', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('POST /books', () => ({ status: 201, body: bookDto() }));

    addPage();
    await fillRequired();
    await joinCollection('Batman', '1');
    await userEvent.selectOptions(
        screen.getByRole('combobox', { name: /Coverage/ }),
        'Covers several volumes',
    );
    await userEvent.type(screen.getByRole('textbox', { name: /Last volume/ }), '3');

    await userEvent.click(saveButton());

    await vi.waitFor(() =>
        expect(posted(api)[0]).toMatchObject({ collection: { volumeFrom: 1, volumeTo: 3 } }),
    );
});

it('asks for the volume number without contacting the server', async () => {
    const api = new FakeApi().signedIn(account());

    addPage();
    await fillRequired();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Part of a collection' }));
    await userEvent.type(screen.getByRole('combobox', { name: /Collection name/ }), 'Batman');

    await userEvent.click(saveButton());

    expect(await screen.findAllByText('Enter the volume number.')).not.toHaveLength(0);
    expect(posted(api)).toEqual([]);
});

it('starts a new book in the collection it was added from', async () => {
    new FakeApi().signedIn(account());

    renderRoute('/books/new?collection=Batman', { '/books/new': <BookFormPage /> });

    expect(await screen.findByRole('checkbox', { name: 'Part of a collection' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: /Collection name/ })).toHaveValue('Batman');
});

it('joins the existing collection the person chooses instead of a similar name', async () => {
    let attempt = 0;
    const api = new FakeApi().signedIn(account()).on('POST /books', () =>
        ++attempt === 1
            ? {
                  status: 409,
                  body: {
                      message: 'Similar',
                      reason: 'collection-similar',
                      details: { name: 'Batmen', candidates: [{ id: 'c1', name: 'Batman' }] },
                  },
              }
            : { status: 201, body: bookDto() },
    );

    addPage();
    await fillRequired();
    await joinCollection('Batmen', '3');
    await userEvent.click(saveButton());

    await userEvent.click(await screen.findByRole('button', { name: 'Join Batman' }));

    await vi.waitFor(() =>
        expect(posted(api)[1]).toMatchObject({ collection: { collection: { name: 'Batman' } } }),
    );
});

it('includes volume 0 in the collection once the person accepts', async () => {
    let attempt = 0;
    const api = new FakeApi().signedIn(account()).on('POST /books', () =>
        ++attempt === 1
            ? {
                  status: 409,
                  body: {
                      message: 'Volume 0',
                      reason: 'volume-zero-disabled',
                      details: { name: 'Batman' },
                  },
              }
            : { status: 201, body: bookDto() },
    );

    addPage();
    await fillRequired();
    await joinCollection('Batman', '0');
    await userEvent.click(saveButton());

    await userEvent.click(await screen.findByRole('button', { name: 'Include volume 0 and save' }));

    await vi.waitFor(() =>
        expect(posted(api)[1]).toMatchObject({ collection: { enableVolumeZero: true } }),
    );
});

const plannedConflict = {
    status: 409,
    body: {
        message: 'Planned',
        reason: 'coverage-conflict',
        details: {
            name: 'Batman',
            conflicts: [
                {
                    id: 'planned',
                    title: 'Batman 12',
                    isbn: null,
                    ownership: 'not-owned',
                    volumeFrom: 12,
                    volumeTo: 12,
                },
            ],
            replaceable: true,
            expectedAfterReplacement: { from: 1, to: 12 },
        },
    },
};

it('deletes the planned record and adds the purchased edition when chosen', async () => {
    let attempt = 0;
    const api = new FakeApi()
        .signedIn(account())
        .on('POST /books', () =>
            ++attempt === 1 ? plannedConflict : { status: 201, body: bookDto() },
        );

    addPage();
    await fillRequired();
    await joinCollection('Batman', '12');
    await userEvent.click(saveButton());
    const dialog = await screen.findByRole('dialog', { name: 'This volume is already planned' });
    const affected = within(dialog).getByText(/Batman 12/);

    await userEvent.click(
        within(dialog).getByRole('button', {
            name: 'Delete planned record and add purchased edition',
        }),
    );

    expect(affected).toHaveTextContent('Batman 12 · Volume 12 · Not owned');
    await vi.waitFor(() => expect(posted(api)[1]).toMatchObject({ replacePlanned: ['planned'] }));
});

it('updates the planned record to the purchased edition and marks it Owned', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('POST /books', () => plannedConflict)
        .on('PUT /books/planned', () => ({ status: 200, body: bookDto({ id: 'planned' }) }))
        .on('PUT /books/planned/reading', () => ({ status: 200, body: { read: false } }));
    const router = addPage();

    await fillRequired();
    await joinCollection('Batman', '12');
    await userEvent.click(saveButton());

    await userEvent.click(
        await screen.findByRole('button', { name: 'Update planned record and mark Owned' }),
    );

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/books/planned'));
    expect(api.calls.find((call) => call.route === 'PUT /books/planned')?.body).toMatchObject({
        title: 'Piranesi',
        ownership: 'owned',
        collection: { volumeFrom: 12, volumeTo: 12 },
    });
});

it('explains a coverage overlap that cannot be replaced', async () => {
    const api = new FakeApi().signedIn(account()).on('POST /books', () => ({
        status: 409,
        body: {
            message: 'Overlap',
            reason: 'coverage-conflict',
            details: {
                name: 'Batman',
                conflicts: [
                    {
                        id: 'omnibus',
                        title: 'Batman omnibus',
                        isbn: null,
                        ownership: 'owned',
                        volumeFrom: 1,
                        volumeTo: 3,
                    },
                ],
                replaceable: false,
                expectedAfterReplacement: null,
            },
        },
    }));

    addPage();
    await fillRequired();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Ownership/ }), 'not-owned');
    await joinCollection('Batman', '2');

    await userEvent.click(saveButton());

    const dialog = await screen.findByRole('dialog', {
        name: 'This coverage overlaps another book',
    });

    expect(within(dialog).getByText(/Batman omnibus · Volumes 1–3 · Owned/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    expect(posted(api)).toHaveLength(1);
});

const bookcases = [
    {
        id: 'oak',
        name: 'Oak bookcase',
        bookCount: 3,
        shelves: [
            { id: 's1', bookcaseId: 'oak', name: 'Shelf 1', bookCount: 1 },
            { id: 's3', bookcaseId: 'oak', name: 'Shelf 3', bookCount: 2 },
        ],
    },
    { id: 'hall', name: 'Hall bookcase', bookCount: 0, shelves: [] },
];

it('saves the chosen shelf and tags, reusing an existing tag', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /bookcases', () => ({ status: 200, body: bookcases }))
        .on('GET /tags', () => ({
            status: 200,
            body: [{ id: 't1', name: 'Fantasy', bookCount: 4 }],
        }))
        .on('POST /books', () => ({ status: 201, body: bookDto() }));

    addPage();
    await fillRequired();
    await userEvent.selectOptions(screen.getByLabelText('Bookcase'), 'Oak bookcase');
    await userEvent.selectOptions(screen.getByLabelText(/^Shelf/), 'Shelf 3');
    const tags = screen.getByRole('combobox', { name: 'Find or create tag' });

    await userEvent.type(tags, 'fantasy');
    await screen.findByRole('option', { name: 'Fantasy' });
    await userEvent.keyboard('{Enter}');
    await userEvent.type(tags, 'Medieval');
    await screen.findByRole('option', { name: 'Create tag “Medieval”' });
    await userEvent.keyboard('{Enter}');

    await userEvent.click(saveButton());

    await vi.waitFor(() =>
        expect(api.calls.find((call) => call.route === 'POST /books')?.body).toMatchObject({
            shelfId: 's3',
            tags: [{ id: 't1' }, { name: 'Medieval' }],
        }),
    );
});

it('asks for a shelf when only a bookcase is chosen, without contacting the server', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /bookcases', () => ({ status: 200, body: bookcases }));

    addPage();
    await fillRequired();
    await userEvent.selectOptions(screen.getByLabelText('Bookcase'), 'Oak bookcase');

    await userEvent.click(saveButton());

    expect(
        await screen.findAllByText(
            'Choose a shelf of this bookcase, or leave the bookcase unassigned.',
        ),
    ).not.toHaveLength(0);
    expect(posted(api)).toEqual([]);
});

it('points to the Bookshelves page while no shelf exists', async () => {
    new FakeApi().signedIn(account()).on('GET /bookcases', () => ({ status: 200, body: [] }));

    addPage();

    expect(
        await screen.findByRole('link', { name: 'Create bookcases and shelves' }),
    ).toHaveAttribute('href', '/bookshelves');
});

it('keeps the location and tags of an edited book', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /bookcases', () => ({ status: 200, body: bookcases }))
        .on('GET /books/b1', () => ({
            status: 200,
            body: bookDto({
                location: {
                    bookcaseId: 'oak',
                    bookcaseName: 'Oak bookcase',
                    shelfId: 's1',
                    shelfName: 'Shelf 1',
                },
                tags: [{ id: 't1', name: 'Fantasy' }],
            }),
        }))
        .on('PUT /books/b1', () => ({ status: 200, body: bookDto() }));

    editPage();
    await screen.findByRole('button', { name: 'Remove the tag Fantasy' });
    await userEvent.type(screen.getByLabelText(/^Title/), ' (2)');

    await userEvent.click(screen.getAllByRole('button', { name: 'Save changes' })[0]!);

    await vi.waitFor(() =>
        expect(api.calls.find((call) => call.route === 'PUT /books/b1')?.body).toMatchObject({
            shelfId: 's1',
            tags: [{ id: 't1' }],
        }),
    );
});

it('keeps a lent book Owned and explains why', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({
        status: 200,
        body: bookDto({
            loan: {
                id: 'l1',
                receiverId: 'r-sam',
                receiverName: 'Sam Taylor',
                lentAt: '2026-10-30T09:00:00.000Z',
            },
        }),
    }));

    editPage();

    const ownership = await screen.findByLabelText(/^Ownership/);

    expect(within(ownership).getByRole('option', { name: 'Not owned' })).toBeDisabled();
    expect(ownership).toHaveAccessibleDescription(
        'This book is lent to Sam Taylor: it stays Owned until its return is recorded.',
    );
});

it('lets a Manga in a collection be saved without title, named from it', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('POST /books', () => ({ status: 201, body: bookDto() }));

    addPage();
    await userEvent.type(await screen.findByLabelText(/^ISBN/), '0-306-40615-2');
    await userEvent.type(screen.getByRole('combobox', { name: 'Add author' }), 'Yukito Kishiro');
    await userEvent.keyboard('{Enter}');
    await userEvent.selectOptions(screen.getByLabelText(/^Category/), 'manga');
    await joinCollection('Gunnm', '3');

    await userEvent.click(saveButton());

    await vi.waitFor(() => expect(posted(api)).toHaveLength(1));
    expect(posted(api)[0]).toMatchObject({ title: '' });
});

it('explains that a Manga in a collection may leave its title empty', async () => {
    new FakeApi().signedIn(account());
    addPage();
    await userEvent.selectOptions(await screen.findByLabelText(/^Category/), 'manga');

    await joinCollection('Gunnm', '3');

    expect(screen.getByLabelText(/^Title/)).not.toBeRequired();
    expect(screen.getByLabelText(/^Title/)).toHaveAccessibleDescription(
        'Optional: leave it empty to name the book from its collection, “Gunnm Vol. 3”.',
    );
});

it('starts a generated title empty, so other edits keep it generated', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({
        status: 200,
        body: bookDto({
            title: 'Gunnm Vol. 3',
            titleGenerated: true,
            category: 'manga',
            collection: { id: 'c1', name: 'Gunnm', volumeFrom: 3, volumeTo: 3 },
        }),
    }));

    editPage();

    const title = await screen.findByLabelText(/^Title/);

    expect(title).toHaveValue('');
    expect(title).not.toBeRequired();
});

it('prefills the last generated title when the book leaves its collection', async () => {
    new FakeApi().signedIn(account()).on('GET /books/b1', () => ({
        status: 200,
        body: bookDto({
            title: 'Gunnm Vol. 3',
            titleGenerated: true,
            category: 'manga',
            collection: { id: 'c1', name: 'Gunnm', volumeFrom: 3, volumeTo: 3 },
        }),
    }));
    editPage();
    await screen.findByLabelText(/^Title/);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Part of a collection' }));

    expect(screen.getByLabelText(/^Title/)).toHaveValue('Gunnm Vol. 3');
    expect(screen.getByLabelText(/^Title/)).toBeRequired();
});

describe('Find book', () => {
    const isbn = '9782253164692';

    function lookedUp(
        overrides: Partial<Extract<BookLookupDto, { kind: 'looked-up' }>> = {},
    ): BookLookupDto {
        return {
            kind: 'looked-up',
            isbn13: isbn,
            found: true,
            fields: {
                title: [],
                authors: [],
                publisher: [],
                publicationDate: [],
                pageCount: [],
                summary: [],
                collection: [],
                category: [],
            },
            authorSpellings: [],
            covers: [],
            unavailable: [],
            ...overrides,
        };
    }

    const ewilanFields = {
        title: [{ value: "D'un monde à l'autre", sources: ['bnf'] }],
        authors: [{ value: ['Pierre Bottero'], sources: ['bnf'] }],
        publisher: [
            { value: 'Librairie générale française', sources: ['bnf'] },
            { value: 'Le livre de poche', sources: ['openlibrary'] },
        ],
        publicationDate: [],
        pageCount: [{ value: 257, sources: ['bnf'] }],
        summary: [],
        collection: [{ value: { name: "La quête d'Ewilan", volume: 1 }, sources: ['bnf'] }],
        category: [],
    };
    const ewilan = lookedUp({ fields: ewilanFields });

    async function findBook(typed = isbn) {
        await userEvent.type(await screen.findByLabelText(/^ISBN/), typed);
        await userEvent.click(screen.getByRole('button', { name: 'Find book' }));
    }

    it('is available once an ISBN is typed', async () => {
        new FakeApi().signedIn(account());

        addPage();

        expect(await screen.findByRole('button', { name: 'Find book' })).toBeDisabled();
    });

    it('is not offered when editing a book', async () => {
        new FakeApi()
            .signedIn(account())
            .on('GET /books/b1', () => ({ status: 200, body: bookDto() }));

        editPage();

        await screen.findByRole('heading', { name: 'Edit book' });
        expect(screen.queryByRole('button', { name: 'Find book' })).not.toBeInTheDocument();
    });

    it('opens the book that already has this ISBN (example 11)', async () => {
        new FakeApi().signedIn(account()).on('POST /books/lookups', () => ({
            status: 200,
            body: { kind: 'existing', bookId: 'b9' },
        }));
        const router = addPage();

        await findBook();

        await vi.waitFor(() => expect(router.state.location.pathname).toBe('/books/b9'));
    });

    it('fills the form with the reviewed values, the preferred source first (examples 12 and 18)', async () => {
        const api = new FakeApi()
            .signedIn(account())
            .on('POST /books/lookups', () => ({ status: 200, body: ewilan }));

        addPage();
        await findBook();
        const review = await screen.findByRole('dialog', { name: 'Review the lookup result' });

        await userEvent.click(within(review).getByRole('button', { name: 'Use these values' }));

        expect(screen.getByLabelText(/^Title/)).toHaveValue("D'un monde à l'autre");
        expect(screen.getByText('Pierre Bottero')).toBeInTheDocument();
        expect(screen.getByLabelText('Publisher')).toHaveValue('Librairie générale française');
        expect(screen.getByLabelText('Page count')).toHaveValue('257');
        expect(screen.getByRole('combobox', { name: /Collection name/ })).toHaveValue(
            "La quête d'Ewilan",
        );
        expect(
            screen.getByText('Lookup values added to the form. Check them, then save the book.'),
        ).toBeInTheDocument();
        expect(api.calls.find((call) => call.route === 'POST /books/lookups')?.body).toEqual({
            isbn,
        });
    });

    const manga = lookedUp({
        fields: { ...ewilanFields, category: [{ value: 'manga', sources: ['bnf'] }] },
    });

    it('shows the category the lookup found in the review', async () => {
        new FakeApi()
            .signedIn(account())
            .on('POST /books/lookups', () => ({ status: 200, body: manga }));
        addPage();

        await findBook();

        expect(
            within(
                await screen.findByRole('dialog', { name: 'Review the lookup result' }),
            ).getByText('Manga'),
        ).toBeInTheDocument();
    });

    it('sets the category the lookup found in the form', async () => {
        new FakeApi()
            .signedIn(account())
            .on('POST /books/lookups', () => ({ status: 200, body: manga }));
        addPage();
        await findBook();
        const review = await screen.findByRole('dialog', { name: 'Review the lookup result' });

        await userEvent.click(within(review).getByRole('button', { name: 'Use these values' }));

        expect(screen.getByLabelText('Category')).toHaveValue('manga');
    });

    const flipflops = lookedUp({
        fields: { ...ewilanFields, authors: [{ value: ["Flipflop's"], sources: ['bnf'] }] },
        authorSpellings: [{ name: "Flipflop's", spelling: 'Flipsflops', sources: ['bnf'] }],
    });

    async function useFlipflops() {
        new FakeApi()
            .signedIn(account())
            .on('POST /books/lookups', () => ({ status: 200, body: flipflops }));
        addPage();
        await findBook();
        const review = await screen.findByRole('dialog', { name: 'Review the lookup result' });

        await userEvent.click(within(review).getByRole('button', { name: 'Use these values' }));
    }

    it("tells the source's spelling of an existing author it filled in", async () => {
        await useFlipflops();

        const hint = screen.getByText("BnF suggests: Flipsflops (instead of Flipflop's)");

        expect(hint).toBeInTheDocument();
    });

    it("uses the source's spelling when chosen", async () => {
        await useFlipflops();

        await userEvent.click(screen.getByRole('button', { name: 'Use the spelling Flipsflops' }));

        expect(screen.getByText('Flipsflops')).toBeInTheDocument();
    });

    it('uses an alternative value the person picks', async () => {
        new FakeApi()
            .signedIn(account())
            .on('POST /books/lookups', () => ({ status: 200, body: ewilan }));

        addPage();
        await findBook();
        const review = await screen.findByRole('dialog', { name: 'Review the lookup result' });

        await userEvent.click(within(review).getByRole('radio', { name: /Le livre de poche/ }));
        await userEvent.click(within(review).getByRole('button', { name: 'Use these values' }));

        expect(screen.getByLabelText('Publisher')).toHaveValue('Le livre de poche');
    });

    it('keeps a typed title unless the person chooses the lookup one (example 12)', async () => {
        new FakeApi()
            .signedIn(account())
            .on('POST /books/lookups', () => ({ status: 200, body: ewilan }));

        addPage();
        await userEvent.type(await screen.findByLabelText(/^Title/), 'Ewilan 1');
        await findBook();
        await userEvent.click(await screen.findByRole('button', { name: 'Use these values' }));
        const conflicts = await screen.findByRole('dialog', {
            name: 'Replace your entered values?',
        });

        await userEvent.click(within(conflicts).getByRole('button', { name: 'Apply' }));

        expect(screen.getByLabelText(/^Title/)).toHaveValue('Ewilan 1');
    });

    it('replaces a typed title when the person chooses so', async () => {
        new FakeApi()
            .signedIn(account())
            .on('POST /books/lookups', () => ({ status: 200, body: ewilan }));

        addPage();
        await userEvent.type(await screen.findByLabelText(/^Title/), 'Ewilan 1');
        await findBook();
        await userEvent.click(await screen.findByRole('button', { name: 'Use these values' }));
        const conflicts = await screen.findByRole('dialog', {
            name: 'Replace your entered values?',
        });

        await userEvent.click(within(conflicts).getByRole('radio', { name: /^Use lookup/ }));
        await userEvent.click(within(conflicts).getByRole('button', { name: 'Apply' }));

        expect(screen.getByLabelText(/^Title/)).toHaveValue("D'un monde à l'autre");
    });

    it('keeps the generated title of a manga in a collection by default', async () => {
        new FakeApi()
            .signedIn(account())
            .on('POST /books/lookups', () => ({ status: 200, body: ewilan }));

        addPage();
        await userEvent.selectOptions(await screen.findByLabelText('Category'), 'manga');
        await findBook();
        const review = await screen.findByRole('dialog', { name: 'Review the lookup result' });
        const keep = within(review).getByRole('radio', { name: 'Keep the generated title' });

        await userEvent.click(within(review).getByRole('button', { name: 'Use these values' }));

        expect(keep).toBeChecked();
        expect(screen.getByLabelText(/^Title/)).toHaveValue('');
    });

    it('takes the chosen cover and uploads it with the book', async () => {
        const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
        const api = new FakeApi()
            .signedIn(account())
            .on('POST /books/lookups', () => ({
                status: 200,
                body: lookedUp({
                    fields: ewilanFields,
                    covers: [{ token: 't1', width: null, height: null, sources: ['openlibrary'] }],
                }),
            }))
            .on('GET /books/lookups/covers/t1', () => ({ status: 200, body: image }))
            .on('POST /books', () => ({ status: 201, body: bookDto() }))
            .on('PUT /books/b1/cover', () => ({ status: 200, body: bookDto({ hasCover: true }) }));

        vi.stubGlobal(
            'URL',
            Object.assign(URL, { createObjectURL: () => 'blob:cover', revokeObjectURL: () => {} }),
        );
        addPage();
        await findBook();
        await userEvent.click(await screen.findByRole('button', { name: 'Use these values' }));
        await screen.findByRole('img', { name: /Cover of/ });

        await userEvent.click(saveButton());

        await vi.waitFor(() =>
            expect(
                api.calls.find((call) => call.route === 'PUT /books/b1/cover')?.body,
            ).toBeInstanceOf(Blob),
        );
    });

    it('says no book was found and keeps the ISBN (example 13)', async () => {
        new FakeApi()
            .signedIn(account())
            .on('POST /books/lookups', () => ({ status: 200, body: lookedUp({ found: false }) }));

        addPage();
        await findBook();

        expect(
            await screen.findByText(
                'No book was found for this ISBN. It is kept: complete the form manually.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/^ISBN/)).toHaveValue(isbn);
        expect(screen.getByRole('button', { name: 'Find book' })).toBeEnabled();
    });

    it('tells an unavailable source apart from no result and offers a retry (example 13)', async () => {
        new FakeApi().signedIn(account()).on('POST /books/lookups', () => ({
            status: 200,
            body: lookedUp({ found: false, unavailable: [{ source: 'bnf', reason: 'failed' }] }),
        }));

        addPage();
        await findBook();

        expect(
            await screen.findByText(
                'Book lookup is unavailable (BnF). Your ISBN is kept. Retry or complete this form manually.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry lookup' })).toBeEnabled();
    });

    it('explains an invalid ISBN beside the field', async () => {
        new FakeApi().signedIn(account()).on('POST /books/lookups', () => ({
            status: 400,
            body: { message: 'Enter a valid ISBN-10 or ISBN-13.', reason: 'isbn-invalid' },
        }));

        addPage();
        await findBook('9782253164691');

        await vi.waitFor(() =>
            expect(screen.getByLabelText(/^ISBN/)).toHaveAttribute('aria-invalid', 'true'),
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

describe('Cover helpers', () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'cover.png', {
        type: 'image/png',
    });

    beforeEach(() => {
        vi.stubGlobal(
            'URL',
            Object.assign(URL, { createObjectURL: () => 'blob:cover', revokeObjectURL: () => {} }),
        );
    });

    function transfer(type: 'paste' | 'drop', data: { files?: File[]; text?: string }) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        const carried = {
            files: data.files ?? [],
            getData: (format: string) =>
                format === 'text/uri-list' || format === 'text/plain' ? (data.text ?? '') : '',
        };

        Object.defineProperty(event, type === 'paste' ? 'clipboardData' : 'dataTransfer', {
            value: carried,
        });

        return event;
    }

    function coverArea() {
        return document.querySelector('.cover-picker__drop')!;
    }

    it('searches the web for the cover by ISBN, in a new tab', async () => {
        new FakeApi().signedIn(account());

        addPage();
        await userEvent.type(await screen.findByLabelText(/^ISBN/), '9782253164692');

        const link = screen.getByRole('link', { name: /Search this cover on the web/ });

        expect(link).toHaveAttribute(
            'href',
            'https://www.google.com/search?tbm=isch&q=9782253164692',
        );
        expect(link).toHaveAttribute('target', '_blank');
    });

    it('searches by title and author for a book without ISBN', async () => {
        new FakeApi().signedIn(account());

        addPage();
        await userEvent.click(
            await screen.findByRole('checkbox', { name: 'This book has no ISBN' }),
        );
        await userEvent.type(screen.getByLabelText(/^Title/), 'Piranesi');

        expect(screen.getByRole('link', { name: /Search this cover on the web/ })).toHaveAttribute(
            'href',
            'https://www.google.com/search?tbm=isch&q=Piranesi',
        );
    });

    it('takes an image pasted outside the text fields', async () => {
        new FakeApi().signedIn(account());

        addPage();
        await screen.findByRole('button', { name: 'Choose cover' });

        document.body.dispatchEvent(transfer('paste', { files: [png] }));

        expect(await screen.findByRole('img', { name: /Cover of/ })).toBeInTheDocument();
    });

    it('leaves a paste into a text field to that field', async () => {
        new FakeApi().signedIn(account());

        addPage();
        const title = await screen.findByLabelText(/^Title/);

        title.dispatchEvent(transfer('paste', { files: [png] }));

        expect(screen.queryByRole('img', { name: /Cover of/ })).not.toBeInTheDocument();
    });

    it('takes an image file dropped on the cover', async () => {
        new FakeApi().signedIn(account());

        addPage();
        await screen.findByRole('button', { name: 'Choose cover' });

        coverArea().dispatchEvent(transfer('drop', { files: [png] }));

        expect(await screen.findByRole('img', { name: /Cover of/ })).toBeInTheDocument();
    });

    it('fetches a picture dragged from a web page by its address', async () => {
        const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
        const api = new FakeApi()
            .signedIn(account())
            .on('POST /books/lookups/covers', () => ({ status: 200, body: image }));

        addPage();
        await screen.findByRole('button', { name: 'Choose cover' });

        coverArea().dispatchEvent(
            transfer('drop', { text: 'https://images.example/piranesi.jpg' }),
        );

        expect(await screen.findByRole('img', { name: /Cover of/ })).toBeInTheDocument();
        expect(api.calls.find((call) => call.route === 'POST /books/lookups/covers')?.body).toEqual(
            { address: 'https://images.example/piranesi.jpg' },
        );
    });

    it('uses the image at a pasted address', async () => {
        const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
        const api = new FakeApi()
            .signedIn(account())
            .on('POST /books/lookups/covers', () => ({ status: 200, body: image }));

        addPage();
        await userEvent.type(
            await screen.findByLabelText('Image address'),
            'https://images.example/piranesi.jpg',
        );

        await userEvent.click(screen.getByRole('button', { name: 'Use this image' }));

        expect(await screen.findByRole('img', { name: /Cover of/ })).toBeInTheDocument();
        expect(screen.getByLabelText('Image address')).toHaveValue('');
        expect(api.calls.find((call) => call.route === 'POST /books/lookups/covers')?.body).toEqual(
            { address: 'https://images.example/piranesi.jpg' },
        );
    });

    it('explains an address without a usable image', async () => {
        new FakeApi().signedIn(account()).on('POST /books/lookups/covers', () => ({
            status: 404,
            body: { message: 'No image', reason: 'cover-address-unavailable' },
        }));

        addPage();
        await userEvent.type(
            await screen.findByLabelText('Image address'),
            'https://images.example/page.html',
        );

        await userEvent.click(screen.getByRole('button', { name: 'Use this image' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No usable image was found at this address.',
        );
    });
});
