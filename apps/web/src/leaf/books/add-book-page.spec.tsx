import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NewBookDto } from '../../../../../packages/contracts/src/http';
import { bookDto } from '../../testing/book-fixtures.test-support';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import type { AddBookState, LookedUpBook } from './add-book-page';
import { AddBookPage } from './add-book-page';

const isbn = '9781635575637';

function lookup(overrides: Partial<LookedUpBook> = {}): LookedUpBook {
    return {
        kind: 'looked-up',
        isbn13: isbn,
        found: true,
        fields: {
            title: [{ value: 'Piranesi', sources: ['bnf'] }],
            authors: [{ value: ['Susanna Clarke'], sources: ['bnf', 'openlibrary'] }],
            publisher: [
                { value: 'Bloomsbury', sources: ['bnf'] },
                { value: 'Bloomsbury Publishing', sources: ['openlibrary'] },
            ],
            publicationDate: [],
            pageCount: [],
            summary: [],
            collection: [],
            category: [],
        },
        authorSpellings: [],
        covers: [],
        unavailable: [],
        pending: [],
        ...overrides,
    };
}

function open(found: LookedUpBook = lookup()) {
    return renderRoute(
        { pathname: '/add', state: { isbn, lookup: found } satisfies AddBookState },
        { '/add': <AddBookPage /> },
    );
}

let api: FakeApi;

beforeEach(() => {
    deviceLanguages(['en-GB']);
    api = new FakeApi().signedIn(account()).on('GET /bookcases', () => ({ status: 200, body: [] }));
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('returns home when opened without a scan', async () => {
    renderRoute('/add', { '/add': <AddBookPage /> });

    expect(await screen.findByText('Elsewhere: /')).toBeInTheDocument();
});

it('fills the form with the preferred source’s values', async () => {
    open();

    expect(await screen.findByLabelText(/^Title/)).toHaveValue('Piranesi');
    expect(screen.getByLabelText('Scanned ISBN')).toHaveValue(isbn);
    expect(screen.getByText('Susanna Clarke')).toBeInTheDocument();
    expect(screen.getByLabelText('Publisher')).toHaveValue('Bloomsbury');
});

it('names the sources still answering, with a way to check again', async () => {
    open(lookup({ pending: ['openlibrary'] }));

    expect(
        await screen.findByText(
            /No answer yet from Open Library; the values found may be incomplete\. Check again to see the rest\./,
        ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Check again' })).toHaveAttribute(
        'href',
        '/scan/found',
    );
});

it('says nothing about late sources when every source answered', async () => {
    open();

    await screen.findByLabelText(/^Title/);

    expect(screen.queryByRole('link', { name: 'Check again' })).not.toBeInTheDocument();
});

it('keeps the same three sections, additional information folded without its values', async () => {
    open(lookup({ fields: { ...lookup().fields, publisher: [] } }));

    expect(await screen.findByRole('group', { name: '01 / Main information' })).toBeVisible();
    expect(screen.getByRole('group', { name: '02 / Location & tags · Optional' })).toBeVisible();
    expect(screen.getByText('03 / Additional information').closest('details')).not.toHaveAttribute(
        'open',
    );
});

it('offers another source’s value and uses it when chosen', async () => {
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Use Bloomsbury Publishing' }));

    expect(screen.getByLabelText('Publisher')).toHaveValue('Bloomsbury Publishing');
});

const flipflops = lookup({
    fields: { ...lookup().fields, authors: [{ value: ["Flipflop's"], sources: ['bnf'] }] },
    authorSpellings: [{ name: "Flipflop's", spelling: 'Flipsflops', sources: ['bnf'] }],
});

it('marks the book as read with one press of the reading button', async () => {
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Not read' }));

    expect(screen.getByRole('button', { name: 'Read' })).toHaveClass('button--pressed');
});

it('unmarks the book with a second press of the reading button', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Not read' }));

    await userEvent.click(screen.getByRole('button', { name: 'Read' }));

    expect(screen.getByRole('button', { name: 'Not read' })).not.toHaveClass('button--pressed');
});

it('changes the category with one press of its button', async () => {
    open();

    await userEvent.click(await screen.findByRole('radio', { name: 'Comics' }));

    expect(screen.getByRole('radio', { name: 'Comics' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Books' })).not.toBeChecked();
});

it('names the category buttons in French', async () => {
    deviceLanguages(['fr-FR']);

    open();

    expect(await screen.findByRole('group', { name: 'Catégorie' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'BD et comics' })).toBeInTheDocument();
});

it('names the reading button in French', async () => {
    deviceLanguages(['fr-FR']);

    open();

    expect(await screen.findByRole('group', { name: 'Votre lecture' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Non lu' })).toBeInTheDocument();
});

it('tells the source’s spelling of an existing author it filled in', async () => {
    open(flipflops);

    expect(
        await screen.findByText("BnF suggests: Flipsflops (instead of Flipflop's)"),
    ).toBeInTheDocument();
});

it('uses the source’s spelling when chosen', async () => {
    open(flipflops);

    await userEvent.click(
        await screen.findByRole('button', { name: 'Use the spelling Flipsflops' }),
    );

    expect(screen.getByText('Flipsflops')).toBeInTheDocument();
});

it('offers the existing author back from Libris, not from the source, once the source’s spelling is used', async () => {
    open(flipflops);

    await userEvent.click(
        await screen.findByRole('button', { name: 'Use the spelling Flipsflops' }),
    );

    expect(
        screen.getByText(
            "Libris suggests: Flipflop's, already in your library (instead of Flipsflops)",
        ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Use Flipflop's" })).not.toBeInTheDocument();
});

it('puts the existing author back when chosen', async () => {
    open(flipflops);
    await userEvent.click(
        await screen.findByRole('button', { name: 'Use the spelling Flipsflops' }),
    );

    await userEvent.click(
        screen.getByRole('button', { name: "Use the existing author Flipflop's" }),
    );

    expect(screen.getByText("Flipflop's")).toBeInTheDocument();
});

it('saves the book with the first cover found, then shows the success screen', async () => {
    api.on('GET /books/lookups/covers/first', () => ({
        status: 200,
        body: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
    }))
        .on('POST /books', () => ({ status: 201, body: bookDto({ id: 'new' }) }))
        .on('PUT /books/new/cover', () => ({ status: 200, body: bookDto({ id: 'new' }) }));
    open(
        lookup({ covers: [{ token: 'first', width: 300, height: 450, sources: ['openlibrary'] }] }),
    );
    await screen.findByAltText('Chosen cover');

    await userEvent.click(screen.getByRole('button', { name: 'Save book' }));

    expect(await screen.findByText('Elsewhere: /saved')).toBeInTheDocument();
    const created = api.calls.find((call) => call.route === 'POST /books')!.body as NewBookDto;

    expect(created).toMatchObject({
        title: 'Piranesi',
        isbn,
        authors: [{ name: 'Susanna Clarke' }],
        ownership: 'owned',
        read: false,
    });
    expect(api.calls.map((call) => call.route)).toContain('PUT /books/new/cover');
});

it('keeps the form and explains a failed save', async () => {
    api.on('POST /books', () => ({ status: 500, body: { message: 'Failed' } }));
    open();
    await screen.findByLabelText(/^Title/);

    await userEvent.click(screen.getByRole('button', { name: 'Save book' }));

    expect(await screen.findByText('The request failed. Try again.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Piranesi');
    expect(screen.queryByText('Elsewhere: /saved')).not.toBeInTheDocument();
});

it('asks before discarding changes when cancelled', async () => {
    open();
    await userEvent.type(await screen.findByLabelText(/^Title/), ' — A Novel');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeInTheDocument();
    expect(screen.queryByText('Elsewhere: /')).not.toBeInTheDocument();
});

it('leaves without asking when nothing was changed', async () => {
    open();
    await screen.findByLabelText(/^Title/);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Elsewhere: /')).toBeInTheDocument();
});

it('asks about a similar author and saves again with the chosen one', async () => {
    let attempts = 0;

    api.on('POST /books', () =>
        ++attempts === 1
            ? {
                  status: 409,
                  body: {
                      code: 'conflict',
                      reason: 'author-similar',
                      message: 'Similar',
                      details: {
                          name: 'Susanna Clarke',
                          candidates: [{ id: 'a1', name: 'Susanna Clarke (2)' }],
                      },
                  },
              }
            : { status: 201, body: bookDto({ id: 'new' }) },
    );
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Save book' }));
    const dialog = await screen.findByRole('dialog', { name: 'Use an existing author?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Use Susanna Clarke (2)' }));

    expect(await screen.findByText('Elsewhere: /saved')).toBeInTheDocument();
    const retried = api.calls.filter((call) => call.route === 'POST /books').at(-1)!.body;

    expect(retried).toMatchObject({ authors: [{ id: 'a1' }] });
});

function refusePublisherOnce() {
    let attempts = 0;

    api.on('POST /books', () =>
        ++attempts === 1
            ? {
                  status: 409,
                  body: {
                      code: 'conflict',
                      reason: 'publisher-similar',
                      message: 'Similar',
                      details: { name: 'Bloomsbury', candidates: ['Bloomsburry'] },
                  },
              }
            : { status: 201, body: bookDto({ id: 'new' }) },
    );
}

it('asks about a close publisher spelling and saves again with the chosen one', async () => {
    refusePublisherOnce();
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Save book' }));
    const dialog = await screen.findByRole('dialog', { name: 'Use an existing publisher?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Use Bloomsburry' }));

    expect(await screen.findByText('Elsewhere: /saved')).toBeInTheDocument();
    const retried = api.calls.filter((call) => call.route === 'POST /books').at(-1)!.body;

    expect(retried).toMatchObject({ publisher: 'Bloomsburry' });
});

it('keeps a close publisher spelling once confirmed as different', async () => {
    refusePublisherOnce();
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Save book' }));

    await userEvent.click(
        await screen.findByRole('button', { name: 'Keep “Bloomsbury” as typed' }),
    );

    expect(await screen.findByText('Elsewhere: /saved')).toBeInTheDocument();
    const retried = api.calls.filter((call) => call.route === 'POST /books').at(-1)!.body;

    expect(retried).toMatchObject({ publisher: 'Bloomsbury', publisherDistinct: true });
});

it('suggests existing publishers while typing the publisher', async () => {
    api.on('GET /publishers', () => ({ status: 200, body: ['Bloomsbury Academic'] }));
    open();
    const field = await screen.findByRole('combobox', { name: 'Publisher' });

    await userEvent.type(field, ' Aca');

    await vi.waitFor(() =>
        expect(
            document.querySelector('datalist option[value="Bloomsbury Academic"]'),
        ).not.toBeNull(),
    );
});

const salon = {
    id: 'salon',
    name: 'Salon',
    bookCount: 3,
    shelves: [{ id: 'top', bookcaseId: 'salon', name: 'Top', bookCount: 3 }],
};

function remember(accountId: string, choices: object) {
    window.localStorage.setItem(
        'media-collection.leaf.last-add.' + accountId,
        JSON.stringify(choices),
    );
}

it('starts with the last saved book’s shelf, category and reading status', async () => {
    api.on('GET /bookcases', () => ({ status: 200, body: [salon] }));
    remember('alex', { category: 'manga', read: true, bookcaseId: 'salon', shelfId: 'top' });

    open();

    expect(await screen.findByRole('combobox', { name: 'Physical location' })).toHaveValue('top');
    expect(screen.getByRole('radio', { name: 'Manga' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Read' })).toHaveClass('button--pressed');
});

it('starts with the lookup’s category over the remembered one', async () => {
    remember('alex', { category: 'books', read: false, bookcaseId: null, shelfId: null });

    open(
        lookup({
            fields: { ...lookup().fields, category: [{ value: 'manga', sources: ['bnf'] }] },
        }),
    );

    expect(await screen.findByRole('radio', { name: 'Manga' })).toBeChecked();
});

it('drops a remembered shelf deleted since', async () => {
    remember('alex', { category: 'manga', read: false, bookcaseId: 'salon', shelfId: 'top' });

    open();

    expect(
        await screen.findByText('No shelf exists yet, so the book stays unassigned.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Manga' })).toBeChecked();
});

it('does not use another account’s choices', async () => {
    remember('sam', { category: 'comics', read: true, bookcaseId: null, shelfId: null });

    open();

    expect(await screen.findByRole('radio', { name: 'Books' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Not read' })).toBeInTheDocument();
});

it('leaves without asking when only the remembered choices are filled in', async () => {
    api.on('GET /bookcases', () => ({ status: 200, body: [salon] }));
    remember('alex', { category: 'manga', read: true, bookcaseId: 'salon', shelfId: 'top' });
    open();
    await screen.findByRole('option', { name: 'Salon – Top' });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Elsewhere: /')).toBeInTheDocument();
});

it('remembers the saved book’s choices for the next scan', async () => {
    api.on('GET /bookcases', () => ({ status: 200, body: [salon] })).on('POST /books', () => ({
        status: 201,
        body: bookDto({
            id: 'new',
            category: 'comics',
            personal: { read: true, note: null },
            location: {
                bookcaseId: 'salon',
                bookcaseName: 'Salon',
                shelfId: 'top',
                shelfName: 'Top',
            },
        }),
    }));
    open();
    await screen.findByLabelText(/^Title/);

    await userEvent.click(screen.getByRole('button', { name: 'Save book' }));

    expect(await screen.findByText('Elsewhere: /saved')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('media-collection.leaf.last-add.alex')!)).toEqual(
        { category: 'comics', read: true, bookcaseId: 'salon', shelfId: 'top' },
    );
});

it('saves a shelf chosen in another bookcase only when the book is saved', async () => {
    const study = {
        id: 'study',
        name: 'Study',
        bookCount: 0,
        shelves: [{ id: 'low', bookcaseId: 'study', name: 'Low', bookCount: 0 }],
    };

    api.on('GET /bookcases', () => ({ status: 200, body: [salon, study] })).on(
        'POST /books',
        () => ({ status: 201, body: bookDto({ id: 'new' }) }),
    );
    remember('alex', { category: 'manga', read: false, bookcaseId: 'salon', shelfId: 'top' });
    open();
    await userEvent.selectOptions(
        await screen.findByRole('combobox', { name: 'Physical location' }),
        'Study – Low',
    );
    const before = api.calls.filter((call) => call.route === 'POST /books').length;

    await userEvent.click(screen.getByRole('button', { name: 'Save book' }));

    await screen.findByText('Elsewhere: /saved');
    expect([before, api.calls.find((call) => call.route === 'POST /books')?.body]).toEqual([
        0,
        expect.objectContaining({ shelfId: 'low' }),
    ]);
});

function refuseCategoryOnce() {
    let attempts = 0;

    api.on('POST /books', () =>
        ++attempts === 1
            ? {
                  status: 409,
                  body: {
                      code: 'conflict',
                      reason: 'collection-category-mismatch',
                      message: 'Category',
                      details: {
                          collectionId: 'naruto',
                          name: 'Naruto',
                          category: 'manga',
                          bookCategory: 'books',
                          bookCount: 12,
                      },
                  },
              }
            : { status: 201, body: bookDto({ id: 'new' }) },
    );
}

it('names the category of the collection a book does not match', async () => {
    refuseCategoryOnce();
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Save book' }));

    const dialog = await screen.findByRole('dialog', { name: 'Category of the collection' });

    expect(dialog).toHaveTextContent('Naruto holds Manga. This book is Books.');
});

it('saves again with the category of the collection', async () => {
    refuseCategoryOnce();
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Save book' }));
    const dialog = await screen.findByRole('dialog', { name: 'Category of the collection' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Use Manga for this book' }));

    expect(await screen.findByText('Elsewhere: /saved')).toBeInTheDocument();
    const retried = api.calls.filter((call) => call.route === 'POST /books').at(-1)!.body;

    expect(retried).toMatchObject({ category: 'manga' });
});

it('takes and locks the category of an existing collection', async () => {
    api.on('GET /collections/names', () => ({
        status: 200,
        body: [
            {
                id: 'aynik',
                name: 'All You Need Is Kill',
                category: 'manga',
                includesVolumeZero: false,
            },
        ],
    }));
    open();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Part of a collection' }));

    await userEvent.type(
        screen.getByRole('combobox', { name: /Collection name/ }),
        'All You Need Is Kill',
    );

    expect(await screen.findByText(/Set by the collection All You Need Is Kill/)).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Manga' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Books' })).toBeDisabled();
});

function knownAuthors() {
    api.on('GET /authors', () => ({
        status: 200,
        body: [
            { id: 'a1', name: 'Susanna Clarke' },
            { id: 'a2', name: 'Susan Cooper' },
        ],
    }));
}

function authorsField() {
    return screen.getByRole('combobox', { name: /^Authors/ });
}

it('suggests the existing authors matching what is typed, without those already chosen', async () => {
    knownAuthors();
    open();
    await screen.findByLabelText(/^Title/);

    await userEvent.type(authorsField(), 'sus');

    const list = await screen.findByRole('listbox', { name: 'Suggestions for Authors' });

    expect(
        within(list)
            .getAllByRole('option')
            .map((option) => option.textContent),
    ).toEqual(['Susan Cooper']);
    expect(api.calls.map((call) => call.route)).toContain('GET /authors?search=sus');
});

it('adds a tapped author as a chip and clears the field', async () => {
    knownAuthors();
    open();
    await screen.findByLabelText(/^Title/);
    await userEvent.type(authorsField(), 'sus');

    await userEvent.click(await screen.findByRole('option', { name: 'Susan Cooper' }));

    expect(
        within(screen.getByRole('list', { name: 'Authors' })).getByText('Susan Cooper'),
    ).toBeVisible();
    expect(authorsField()).toHaveValue('');
});

it('saves a tapped author as the existing one', async () => {
    knownAuthors();
    api.on('POST /books', () => ({ status: 201, body: bookDto({ id: 'new' }) }));
    open();
    await screen.findByLabelText(/^Title/);
    await userEvent.type(authorsField(), 'sus');
    await userEvent.click(await screen.findByRole('option', { name: 'Susan Cooper' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save book' }));

    expect(await screen.findByText('Elsewhere: /saved')).toBeInTheDocument();
    const created = api.calls.find((call) => call.route === 'POST /books')!.body as NewBookDto;

    expect(created.authors).toEqual([{ name: 'Susanna Clarke' }, { id: 'a2' }]);
});

it('still adds a new author typed in full with Add', async () => {
    knownAuthors();
    open();
    await screen.findByLabelText(/^Title/);
    await userEvent.type(authorsField(), 'Ursula K. Le Guin');

    await userEvent.click(screen.getByRole('button', { name: 'Add author' }));

    expect(
        within(screen.getByRole('list', { name: 'Authors' })).getByText('Ursula K. Le Guin'),
    ).toBeVisible();
    expect(authorsField()).toHaveValue('');
});

it('shows no author list when no existing author matches', async () => {
    api.on('GET /authors', () => ({ status: 200, body: [] }));
    open();
    await screen.findByLabelText(/^Title/);

    await userEvent.type(authorsField(), 'zz');

    await vi.waitFor(() =>
        expect(api.calls.map((call) => call.route)).toContain('GET /authors?search=zz'),
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

function knownCollections() {
    api.on('GET /collections/names', () => ({
        status: 200,
        body: [
            {
                id: 'aynik',
                name: 'All You Need Is Kill',
                category: 'manga',
                includesVolumeZero: false,
            },
        ],
    }));
}

it('suggests the existing collections matching what is typed', async () => {
    knownCollections();
    open();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Part of a collection' }));

    await userEvent.type(screen.getByRole('combobox', { name: /Collection name/ }), 'all');

    expect(
        await screen.findByRole('listbox', { name: 'Suggestions for Collection name' }),
    ).toHaveTextContent('All You Need Is Kill');
});

it('fills a tapped collection, locks its category and leaves the volume to fill', async () => {
    knownCollections();
    open();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Part of a collection' }));
    await userEvent.type(screen.getByRole('combobox', { name: /Collection name/ }), 'all');

    await userEvent.click(await screen.findByRole('option', { name: 'All You Need Is Kill' }));

    expect(screen.getByRole('combobox', { name: /Collection name/ })).toHaveValue(
        'All You Need Is Kill',
    );
    expect(await screen.findByText(/Set by the collection All You Need Is Kill/)).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Books' })).toBeDisabled();
    expect(screen.getByLabelText(/^Volume/)).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
