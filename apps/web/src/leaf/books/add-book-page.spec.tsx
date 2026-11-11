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

    expect(await screen.findByRole('option', { name: 'Top' })).toBeInTheDocument();
    expect(screen.getByLabelText('Bookcase')).toHaveValue('salon');
    expect(screen.getByLabelText('Shelf')).toHaveValue('top');
    expect(screen.getByLabelText('Category')).toHaveValue('manga');
    expect(screen.getByLabelText(/^Your reading/)).toHaveValue('read');
});

it('starts with the lookup’s category over the remembered one', async () => {
    remember('alex', { category: 'books', read: false, bookcaseId: null, shelfId: null });

    open(
        lookup({
            fields: { ...lookup().fields, category: [{ value: 'manga', sources: ['bnf'] }] },
        }),
    );

    expect(await screen.findByLabelText('Category')).toHaveValue('manga');
});

it('drops a remembered shelf deleted since', async () => {
    remember('alex', { category: 'manga', read: false, bookcaseId: 'salon', shelfId: 'top' });

    open();

    expect(await screen.findByLabelText('Bookcase')).toHaveValue('');
    expect(screen.queryByLabelText('Shelf')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toHaveValue('manga');
});

it('does not use another account’s choices', async () => {
    remember('sam', { category: 'comics', read: true, bookcaseId: null, shelfId: null });

    open();

    expect(await screen.findByLabelText('Category')).toHaveValue('books');
    expect(screen.getByLabelText(/^Your reading/)).toHaveValue('unread');
});

it('leaves without asking when only the remembered choices are filled in', async () => {
    api.on('GET /bookcases', () => ({ status: 200, body: [salon] }));
    remember('alex', { category: 'manga', read: true, bookcaseId: 'salon', shelfId: 'top' });
    open();
    await screen.findByRole('option', { name: 'Top' });

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
