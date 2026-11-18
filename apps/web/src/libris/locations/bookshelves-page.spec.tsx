import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
    BookcaseDto,
    BookcaseSpinesDto,
    BookListItemDto,
} from '../../../../../packages/contracts/src/http';
import { bookItem } from '../../testing/book-fixtures.test-support';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { BookshelvesPage } from './bookshelves-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
});

const bookcases: BookcaseDto[] = [
    {
        id: 'oak',
        name: 'Oak bookcase',
        size: 'large',
        bookCount: 64,
        shelves: [
            { id: 's1', bookcaseId: 'oak', name: 'Shelf 1', bookCount: 0 },
            { id: 's3', bookcaseId: 'oak', name: 'Shelf 3', bookCount: 64 },
        ],
    },
    {
        id: 'study',
        name: 'Study bookcase',
        size: 'small',
        bookCount: 2,
        shelves: [{ id: 'top', bookcaseId: 'study', name: 'Top', bookCount: 2 }],
    },
    { id: 'hall', name: 'Hall', size: 'large', bookCount: 0, shelves: [] },
];
const oakSpines: BookcaseSpinesDto = {
    bookcaseId: 'oak',
    shelves: [
        { shelfId: 's1', books: [] },
        {
            shelfId: 's3',
            books: [
                {
                    id: 'dune',
                    title: 'Dune',
                    authors: ['Frank Herbert'],
                    category: 'books',
                    pageCount: 612,
                },
                { id: 'akira', title: 'Akira', authors: [], category: 'manga', pageCount: null },
                {
                    id: 'hyperion',
                    title: 'Hyperion',
                    authors: ['Dan Simmons'],
                    category: 'books',
                    pageCount: 480,
                },
            ],
        },
    ],
};
const studySpines: BookcaseSpinesDto = {
    bookcaseId: 'study',
    shelves: [
        {
            shelfId: 'top',
            books: [
                {
                    id: 'b1',
                    title: 'Piranesi',
                    authors: ['Susanna Clarke'],
                    category: 'books',
                    pageCount: 272,
                },
            ],
        },
    ],
};

function covers(total: number, items = total): { total: number; items: BookListItemDto[] } {
    return {
        total,
        items: Array.from({ length: Math.min(items, 16) }, (_, index) =>
            bookItem({ id: 'c' + index, title: 'Cover ' + index }),
        ),
    };
}

function show(path = '/bookshelves') {
    return renderRoute(path, { '/bookshelves': <BookshelvesPage /> });
}

function api(role: 'owner' | 'guest' = 'owner') {
    return new FakeApi()
        .signedIn(account({ role }))
        .on('GET /bookcases', () => ({ status: 200, body: bookcases }))
        .on('GET /bookcases/oak/spines', () => ({ status: 200, body: oakSpines }))
        .on('GET /bookcases/study/spines', () => ({ status: 200, body: studySpines }))
        .on('GET /books', () => ({ status: 200, body: covers(2) }));
}

function drawn(name: string) {
    return screen.getByRole('region', { name }).style.getPropertyValue('--wall-bay-width');
}

function width() {
    return screen.getByRole('group', { name: 'Width' });
}

function strip() {
    return screen.getByRole('navigation', { name: 'Bookcases' });
}

function panel() {
    return screen.getByRole('complementary', { name: 'Selected shelf' });
}

async function shown(path?: string) {
    const router = show(path);

    await screen.findByRole('list', { name: 'Books on Shelf 3' });

    return router;
}

it('sums up the bookcases, shelves and books on the title line', async () => {
    api();

    show();

    expect(await screen.findByText('3 bookcases · 3 shelves · 66 books')).toBeInTheDocument();
});

it('shows every bookcase in the strip with its counts and marks the open one', async () => {
    api();

    await shown();

    expect(
        within(strip())
            .getAllByRole('button')
            .map((button) => [button.textContent, button.getAttribute('aria-current')]),
    ).toEqual([
        ['Oak bookcase2 shelves · 64 books', 'true'],
        ['Study bookcase1 shelf · 2 books', null],
        ['Hall0 shelves · 0 books', null],
    ]);
});

it('opens the first bookcase and its first shelf without a selection in the address', async () => {
    api();

    await shown();

    expect([
        screen.getByRole('heading', { level: 2, name: 'Oak bookcase' }),
        within(panel()).getByRole('heading', { name: '0 books on Shelf 1' }),
    ]).toHaveLength(2);
});

it('opens a bookcase from the strip with its first shelf selected', async () => {
    const calls = api();
    const router = await shown();

    await userEvent.click(within(strip()).getByRole('button', { name: /^Study bookcase/ }));

    expect([
        await within(panel()).findByRole('heading', { name: '2 books on Top' }),
        router.state.location.search,
        calls.calls.map((call) => call.route),
    ]).toEqual([
        expect.anything(),
        '?bookcase=study',
        expect.arrayContaining(['GET /bookcases/study/spines']),
    ]);
});

it('selects a shelf by its name and writes it to the address', async () => {
    api();
    const router = await shown();

    await userEvent.click(screen.getByRole('button', { name: 'Shelf 3 · 64 books' }));

    expect([
        await within(panel()).findByRole('heading', { name: '64 books on Shelf 3' }),
        screen.getByRole('button', { name: 'Shelf 3 · 64 books' }),
        router.state.location.search,
    ]).toEqual([expect.anything(), expect.objectContaining({ ariaCurrent: 'true' }), '?shelf=s3']);
});

it('opens the bookcase of the address when the shelf of the address stands in another', async () => {
    api();

    show('/bookshelves?bookcase=study&shelf=s3');

    expect([
        await screen.findByRole('heading', { level: 2, name: 'Study bookcase' }),
        await within(panel()).findByRole('heading', { name: '2 books on Top' }),
    ]).toHaveLength(2);
});

it('draws one spine per book, named with its title and author, linked to the book', async () => {
    api();

    await shown();

    expect(
        within(screen.getByRole('list', { name: 'Books on Shelf 3' }))
            .getAllByRole('link')
            .map((link) => [link.getAttribute('aria-label'), link.getAttribute('href')]),
    ).toEqual([
        ['Dune · Frank Herbert', '/books/dune'],
        ['Akira', '/books/akira'],
        ['Hyperion · Dan Simmons', '/books/hyperion'],
    ]);
});

it('keeps a shelf to one stop in the Tab order', async () => {
    api();

    await shown();

    expect(
        within(screen.getByRole('list', { name: 'Books on Shelf 3' }))
            .getAllByRole('link')
            .map((link) => link.tabIndex),
    ).toEqual([0, -1, -1]);
});

it('moves from spine to spine with the arrow keys', async () => {
    api();
    await shown();
    screen.getByRole('link', { name: 'Dune · Frank Herbert' }).focus();

    await userEvent.keyboard('{ArrowRight}{ArrowRight}');

    expect(screen.getByRole('link', { name: 'Hyperion · Dan Simmons' })).toHaveFocus();
});

it('shows the title and author of the pointed spine', async () => {
    api();
    await shown();

    await userEvent.hover(screen.getByRole('link', { name: 'Dune · Frank Herbert' }));

    expect(screen.getByText('Dune · Frank Herbert', { selector: 'span' })).toBeInTheDocument();
});

it('asks for the covers of the selected shelf in shelf order', async () => {
    const calls = api();

    await shown('/bookshelves?shelf=s3');

    expect(calls.calls.map((call) => call.route)).toContain(
        'GET /books?location=shelf%3As3&sort=shelf&limit=16',
    );
});

it('shows every cover when they fit in two rows', async () => {
    api().on('GET /books', () => ({ status: 200, body: covers(10) }));

    await shown('/bookshelves?shelf=s3');

    expect([
        (await within(panel()).findAllByRole('link', { name: /^Cover/ })).length,
        within(panel()).queryByRole('link', { name: /more books/ }),
    ]).toEqual([10, null]);
});

it('ends the two rows with a tile counting the other books', async () => {
    api().on('GET /books', () => ({ status: 200, body: covers(64) }));

    await shown('/bookshelves?shelf=s3');

    expect([
        (await within(panel()).findAllByRole('link', { name: /^Cover/ })).length,
        within(panel()).getByRole('link', { name: '55 more books on Shelf 3' }),
    ]).toEqual([9, expect.objectContaining({ textContent: '+55 more' })]);
});

it('opens the shelf in the Library from the tile and from the link', async () => {
    api().on('GET /books', () => ({ status: 200, body: covers(64) }));

    await shown('/bookshelves?shelf=s3');

    expect([
        (
            await within(panel()).findByRole('link', { name: '55 more books on Shelf 3' })
        ).getAttribute('href'),
        within(panel())
            .getByRole('link', { name: 'Open this shelf in the Library' })
            .getAttribute('href'),
    ]).toEqual(['/books?location=shelf%3As3', '/books?location=shelf%3As3']);
});

it('marks a lent book among the covers', async () => {
    api().on('GET /books', () => ({
        status: 200,
        body: {
            total: 1,
            items: [
                bookItem({
                    title: 'Dune',
                    authors: ['Frank Herbert'],
                    loan: {
                        id: 'l1',
                        receiverId: 'r-sam',
                        receiverName: 'Sam Taylor',
                        lentAt: '2026-10-30T09:00:00.000Z',
                    },
                }),
            ],
        },
    }));

    await shown('/bookshelves?shelf=s3');

    expect(
        await within(panel()).findByRole('link', { name: 'Dune · Frank Herbert' }),
    ).toHaveTextContent('Lent');
});

it('says when the selected shelf has no book', async () => {
    api().on('GET /books', () => ({ status: 200, body: covers(0) }));

    await shown('/bookshelves?shelf=s1');

    expect(await within(panel()).findByText('No book is on this shelf yet.')).toBeInTheDocument();
});

it('invites to add a shelf to a bookcase without shelves', async () => {
    api();

    show('/bookshelves?bookcase=hall');

    expect([
        await screen.findByText('This bookcase has no shelf yet. Add one to assign books to it.', {
            selector: '.wall-bookcase p',
        }),
        screen.getByRole('button', { name: 'Add shelf' }),
    ]).toHaveLength(2);
});

it('shows a Guest the bookcases without managing them', async () => {
    api('guest');

    await shown();

    expect(
        ['New bookcase', 'Add shelf', 'Delete bookcase', 'Delete shelf', 'Move shelf'].map((name) =>
            screen.queryByRole('button', { name }),
        ),
    ).toEqual([null, null, null, null, null]);
});

it('has no search field any more', async () => {
    api();

    await shown();

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
});

it('offers the Wall, the Wall v2, the Ribbons and the Columns in the View choice', async () => {
    api();

    await shown();

    expect(
        within(screen.getByRole('radiogroup', { name: 'View' }))
            .getAllByRole('radio')
            .map((choice) => [choice.textContent, choice.getAttribute('aria-checked')]),
    ).toEqual([
        ['Wall', 'true'],
        ['Wall v2', 'false'],
        ['Ribbons', 'false'],
        ['Columns', 'false'],
    ]);
});

it('moves to the next view with the arrow keys', async () => {
    api();
    const router = await shown();

    screen.getByRole('radio', { name: 'Wall' }).focus();

    await userEvent.keyboard('{ArrowRight}');

    expect([screen.getByRole('radio', { name: 'Wall v2' }), router.state.location.search]).toEqual([
        expect.objectContaining({ ariaChecked: 'true' }),
        '?view=wall-v2',
    ]);
});

it('falls back to the Wall for an unknown view', async () => {
    api();

    show('/bookshelves?view=unknown');

    expect(await screen.findByRole('navigation', { name: 'Bookcases' })).toBeInTheDocument();
});

it('keeps the view in the address when selecting a shelf', async () => {
    api();
    const router = await shown('/bookshelves?view=wall');

    await userEvent.click(screen.getByRole('button', { name: 'Shelf 3 · 64 books' }));

    expect(router.state.location.search).toBe('?view=wall&shelf=s3');
});

it('creates a shelf in the open bookcase', async () => {
    const calls = api().on('POST /bookcases/oak/shelves', () => ({
        status: 201,
        body: { id: 'bottom', bookcaseId: 'oak', name: 'Bottom', bookCount: 0 },
    }));

    await shown();
    await userEvent.click(screen.getByRole('button', { name: 'Add shelf' }));
    const dialog = screen.getByRole('dialog', { name: 'Create a shelf' });

    await userEvent.type(within(dialog).getByLabelText(/Shelf name/), 'Bottom');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create shelf' }));

    expect(await screen.findByText('“Bottom” was created.')).toBeInTheDocument();
    expect(calls.calls).toContainEqual({
        route: 'POST /bookcases/oak/shelves',
        body: { name: 'Bottom' },
    });
});

it('moves a shelf to another bookcase and explains a name conflict there', async () => {
    api().on('PATCH /shelves/s3', () => ({
        status: 409,
        body: { message: 'Taken', reason: 'shelf-name-taken' },
    }));
    await shown('/bookshelves?shelf=s3');
    await userEvent.click(within(panel()).getByRole('button', { name: 'Move shelf' }));
    const dialog = screen.getByRole('dialog', { name: 'Move Shelf 3' });

    await userEvent.selectOptions(within(dialog).getByLabelText(/Bookcase/), 'Study bookcase');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Move shelf' }));

    expect(
        await within(dialog).findByText(
            'This bookcase already has a shelf with an equivalent name.',
        ),
    ).toBeInTheDocument();
});

it('opens the screen to add books to the selected shelf, first of its actions', async () => {
    api();
    const router = await shown('/bookshelves?shelf=s3');
    const actions = within(panel()).getAllByRole('button');

    await userEvent.click(within(panel()).getByRole('button', { name: 'Add books' }));

    expect(actions[0]).toHaveAccessibleName('Add books');
    expect(router.state.location.pathname + router.state.location.search).toBe(
        '/bookshelves/shelves/s3/add-books?location=none',
    );
});

it('offers a Guest no way to add books to a shelf', async () => {
    api('guest');

    await shown('/bookshelves?shelf=s3');

    expect(screen.queryByRole('button', { name: 'Add books' })).not.toBeInTheDocument();
});

it('shows the message a finished action arrives with', async () => {
    api();

    renderRoute(
        {
            pathname: '/bookshelves',
            search: '?shelf=s3',
            state: { done: '2 books are now on Shelf 3.' },
        },
        { '/bookshelves': <BookshelvesPage /> },
    );

    expect(await screen.findByText('2 books are now on Shelf 3.')).toBeInTheDocument();
});

it('tells how many books become unassigned before deleting a shelf', async () => {
    api();
    await shown('/bookshelves?shelf=s3');

    await userEvent.click(within(panel()).getByRole('button', { name: 'Delete shelf' }));

    expect(
        within(screen.getByRole('dialog', { name: 'Delete Shelf 3?' })).getByText(
            '64 books will become unassigned. No books will be deleted. The shelf definition will be removed.',
        ),
    ).toBeInTheDocument();
});

it('tells which shelves go with a deleted bookcase', async () => {
    api();
    await shown('/bookshelves?shelf=s3');

    await userEvent.click(screen.getByRole('button', { name: 'Delete bookcase' }));

    expect(
        within(screen.getByRole('dialog', { name: 'Delete Oak bookcase?' })).getByText(
            '64 books will become unassigned. No books will be deleted. The bookcase and its 2 shelf definitions will be removed.',
        ),
    ).toBeInTheDocument();
});

it('deletes a shelf once confirmed', async () => {
    const calls = api().on('DELETE /shelves/s3', () => ({ status: 204 }));

    await shown('/bookshelves?shelf=s3');
    await userEvent.click(within(panel()).getByRole('button', { name: 'Delete shelf' }));

    await userEvent.click(
        within(screen.getByRole('dialog', { name: 'Delete Shelf 3?' })).getByRole('button', {
            name: 'Delete shelf',
        }),
    );

    expect(
        await screen.findByText('“Shelf 3” was deleted. Its books were kept.'),
    ).toBeInTheDocument();
    expect(calls.calls.map((call) => call.route)).toContain('DELETE /shelves/s3');
});

it('invites to create the first bookcase', async () => {
    new FakeApi().signedIn(account()).on('GET /bookcases', () => ({ status: 200, body: [] }));

    show();

    expect(
        await screen.findByText(
            'Create a bookcase, then add shelves inside it. Books may remain unassigned.',
        ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create bookcase' })).toBeInTheDocument();
});

it('offers an Owner the width of the open bookcase before Add shelf', async () => {
    api();

    await shown();

    const order = width().compareDocumentPosition(
        screen.getByRole('button', { name: 'Add shelf' }),
    );
    const addShelfFollows = (order & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

    expect(within(width()).getByRole('radio', { name: 'Large' })).toBeChecked();
    expect(addShelfFollows).toBe(true);
});

it('draws a Large bookcase with shelves 420 px wide', async () => {
    api();

    await shown();

    expect(drawn('Oak bookcase')).toBe('420px');
});

it('draws a Small bookcase with shelves 210 px wide', async () => {
    api();

    show('/bookshelves?bookcase=study');

    await screen.findByRole('list', { name: 'Books on Top' });
    expect(drawn('Study bookcase')).toBe('210px');
    expect(within(width()).getByRole('radio', { name: 'Small' })).toBeChecked();
});

it('makes the open bookcase Small at once, saves it and redraws it', async () => {
    let saved: BookcaseDto[] = bookcases;
    const calls = api()
        .on('GET /bookcases', () => ({ status: 200, body: saved }))
        .on('PATCH /bookcases/oak', () => {
            saved = bookcases.map((bookcase) =>
                bookcase.id === 'oak' ? { ...bookcase, size: 'small' } : bookcase,
            );

            return { status: 200, body: saved[0] };
        });

    await shown();

    await userEvent.click(within(width()).getByRole('radio', { name: 'Small' }));

    expect(drawn('Oak bookcase')).toBe('210px');
    expect(calls.calls).toContainEqual({ route: 'PATCH /bookcases/oak', body: { size: 'small' } });
    await vi.waitFor(() =>
        expect(calls.calls.filter((call) => call.route === 'GET /bookcases')).toHaveLength(2),
    );
    expect(within(width()).getByRole('radio', { name: 'Small' })).toBeChecked();
    expect(drawn('Oak bookcase')).toBe('210px');
});

it('puts the width back and shows the error when the save fails', async () => {
    api().on('PATCH /bookcases/oak', () => ({
        status: 403,
        body: { message: 'Read only', reason: 'guest-read-only' },
    }));
    await shown();

    await userEvent.click(within(width()).getByRole('radio', { name: 'Small' }));

    expect(
        await screen.findByText('Guest accounts can view the library but cannot change it.'),
    ).toBeInTheDocument();
    expect(within(width()).getByRole('radio', { name: 'Large' })).toBeChecked();
    expect(drawn('Oak bookcase')).toBe('420px');
});

it('shows a Guest the saved width without the switch', async () => {
    api('guest');

    show('/bookshelves?bookcase=study');

    await screen.findByRole('list', { name: 'Books on Top' });
    expect(screen.queryByRole('group', { name: 'Width' })).not.toBeInTheDocument();
    expect(drawn('Study bookcase')).toBe('210px');
});

it('draws a Small bookcase half as wide in the strip', async () => {
    api();

    await shown();

    const miniatures = within(strip())
        .getAllByRole('button')
        .map((button) => button.querySelector('.wall-miniature')?.className);

    expect(miniatures).toEqual([
        'wall-miniature',
        'wall-miniature wall-miniature--small',
        'wall-miniature',
    ]);
});

async function wallLine() {
    const router = show('/bookshelves?view=wall-v2');

    await screen.findByRole('list', { name: 'Books on Shelf 3' });

    return router;
}

function line() {
    return screen.getByRole('region', { name: 'Bookcases' });
}

it('draws every bookcase side by side in Wall v2, without the strip of miniatures', async () => {
    api();

    await wallLine();

    const names = within(line())
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent);

    expect(names).toEqual(['Oak bookcase', 'Study bookcase', 'Hall']);
    expect(screen.queryByRole('navigation', { name: 'Bookcases' })).not.toBeInTheDocument();
});

it('offers a Go to button per bookcase in Wall v2, the open one current', async () => {
    api();

    await wallLine();

    const jumps = within(screen.getByRole('navigation', { name: 'Go to a bookcase' }))
        .getAllByRole('button')
        .map((button) => [button.textContent, button.getAttribute('aria-current')]);

    expect(jumps).toEqual([
        ['Oak bookcase', 'true'],
        ['Study bookcase', null],
        ['Hall', null],
    ]);
});

it('selects a shelf of another bookcase in Wall v2', async () => {
    api();
    const router = await wallLine();

    await userEvent.click(within(line()).getByRole('button', { name: /^Top/ }));

    expect(router.state.location.search).toBe('?view=wall-v2&shelf=top');
});

it('gives each bookcase of Wall v2 its edit, add shelf and delete buttons', async () => {
    api();

    await wallLine();

    const oak = within(line()).getByRole('region', { name: 'Oak bookcase' });
    const buttons = within(oak)
        .getAllByRole('button', { name: /bookcase|shelf$/ })
        .map((button) => button.getAttribute('aria-label'));

    expect(buttons).toEqual(['Edit bookcase', 'Add shelf', 'Delete bookcase']);
});

it('saves the name and the width from the Edit bookcase dialog of Wall v2', async () => {
    const calls = api().on('PATCH /bookcases/oak', () => ({ status: 200, body: bookcases[0] }));

    await wallLine();
    const oak = within(line()).getByRole('region', { name: 'Oak bookcase' });

    await userEvent.click(within(oak).getByRole('button', { name: 'Edit bookcase' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit bookcase' });

    await userEvent.click(within(dialog).getByRole('radio', { name: 'Small' }));
    await userEvent.clear(within(dialog).getByLabelText(/Bookcase name/));
    await userEvent.type(within(dialog).getByLabelText(/Bookcase name/), 'Oak');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await screen.findByText('“Oak bookcase” is saved.');
    expect(calls.calls).toContainEqual({
        route: 'PATCH /bookcases/oak',
        body: { name: 'Oak', size: 'small' },
    });
});

it('puts the shelf actions on the title line of the Wall v2 panel', async () => {
    api();

    await wallLine();

    const panel = screen.getByRole('complementary', { name: 'Selected shelf' });
    const actions = within(panel)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? button.textContent);

    expect(actions).toEqual(['Rename shelf', 'Add books', 'Move shelf', 'Delete shelf']);
});

it('shows a Guest the bookcases and the covers of Wall v2 without any action', async () => {
    api('guest');

    await wallLine();

    const panel = screen.getByRole('complementary', { name: 'Selected shelf' });
    const buttons = [
        ...within(line()).queryAllByRole('button', { name: /bookcase|Add shelf/ }),
        ...within(panel).queryAllByRole('button'),
    ];

    expect(buttons).toEqual([]);
});
