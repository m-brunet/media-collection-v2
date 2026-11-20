import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deviceLanguages } from '../../testing/fake-api.test-support';
import { card, library, show, statistics } from './statistics-fixtures.test-support';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('shows the four big numbers', async () => {
    library();

    show();

    await screen.findByRole('heading', { name: 'Owned books' });

    expect(
        ['Owned books', 'Pages', 'Total price', 'Read by you'].map(
            (name) => card(name).textContent,
        ),
    ).toEqual([
        'Owned books4,500in 38 collections and 61 single books',
        'Pages96,420on 412 of 4,500 books',
        'Total price€3,284.50on 398 of 4,500 books · 4,102 without a price',
        'Read by you31269% of your books · 138 left to read',
    ]);
});
it('links the books without a price to the library filters', async () => {
    library();

    show('/statistics?category=manga');

    const link = await screen.findByRole('link', { name: '4,102 without a price' });

    expect(link).toHaveAttribute('href', '/books?category=manga&ownership=owned&price=without');
});
it('shows each category with its number and share', async () => {
    library();

    show();

    const legend = await screen.findByRole('list', { name: 'By category' });

    expect(
        within(legend)
            .getAllByRole('listitem')
            .map((item) => item.textContent),
    ).toEqual(['Manga268 · 60%', 'Comics97 · 22%', 'Books85 · 19%']);
});
it('colours the books with the accent, the manga yellow and the comics light blue', async () => {
    library();

    show();

    const legend = await screen.findByRole('list', { name: 'By category' });

    expect(
        within(legend)
            .getAllByRole('listitem')
            .map((item) => [
                item.textContent,
                item.querySelector<HTMLElement>('.statistics-legend__swatch')?.style.background,
            ]),
    ).toEqual([
        ['Manga268 · 60%', 'var(--color-chart-2)'],
        ['Comics97 · 22%', 'var(--color-chart-3)'],
        ['Books85 · 19%', 'var(--color-chart-1)'],
    ]);
});
it('dims the categories that are not chosen', async () => {
    library();

    show('/statistics?category=manga');

    const legend = await screen.findByRole('list', { name: 'By category' });

    expect(
        within(legend)
            .getAllByRole('listitem')
            .map((item) => item.classList.contains('statistics-legend--dimmed')),
    ).toEqual([false, true, true]);
});
it('shows the reading and the collections', async () => {
    library();

    show();

    await screen.findByRole('heading', { name: 'Your reading' });

    expect([card('Your reading').textContent, card('Collections').textContent]).toEqual([
        expect.stringContaining('Read312 · 69%Not read138 · 31%'),
        expect.stringContaining('Finished14Unfinished24187 volumes missing in total.'),
    ]);
});
function legend(name: string) {
    return within(screen.getByRole('list', { name }))
        .getAllByRole('listitem')
        .map((item) => item.textContent);
}

function countBy(group: string, name: 'By books' | 'By pages') {
    return within(screen.getByRole('group', { name: group })).getByRole('radio', { name });
}

it('starts the categories and the reading on their number of books', async () => {
    library();

    show();

    await screen.findByRole('list', { name: 'By category' });
    expect([
        countBy('Count the categories by', 'By books'),
        countBy('Count your reading by', 'By books'),
    ]).toEqual([
        expect.objectContaining({ checked: true }),
        expect.objectContaining({ checked: true }),
    ]);
});
it('shows the pages of each category once By pages is chosen', async () => {
    library();
    show();
    await screen.findByRole('list', { name: 'By category' });

    await userEvent.click(countBy('Count the categories by', 'By pages'));

    expect(legend('By category')).toEqual([
        'Manga51,200 · 53%',
        'Books30,100 · 31%',
        'Comics15,120 · 16%',
    ]);
    expect(card('By category').textContent).toContain('Pages known on 412 of 450 books');
});
it('shows the pages read and not read once By pages is chosen', async () => {
    library();
    show();
    await screen.findByRole('list', { name: 'Your reading' });

    await userEvent.click(countBy('Count your reading by', 'By pages'));

    expect(legend('Your reading')).toEqual(['Read61,200 · 71%', 'Not read25,300 · 29%']);
    expect(card('Your reading').textContent).toContain(
        'Only your own reading status.Pages known on 401 of 450 books',
    );
});
it('keeps the reading on books when the categories count pages', async () => {
    library();
    show();
    await screen.findByRole('list', { name: 'By category' });

    await userEvent.click(countBy('Count the categories by', 'By pages'));

    expect(legend('Your reading')).toEqual(['Read312 · 69%', 'Not read138 · 31%']);
});
it('says nothing of the known pages when every book has its page count', async () => {
    library(
        statistics({
            categories: { books: 1, manga: 2, comics: 0 },
            categoryPages: {
                books: { pages: 272, known: 1 },
                manga: { pages: 384, known: 2 },
                comics: { pages: 0, known: 0 },
            },
        }),
    );
    show();
    await screen.findByRole('list', { name: 'By category' });

    await userEvent.click(countBy('Count the categories by', 'By pages'));

    expect(card('By category').textContent).not.toContain('Pages known');
});
it('shows an empty ring on 0 books when no book has a page count', async () => {
    library(
        statistics({
            categoryPages: {
                books: { pages: 0, known: 0 },
                manga: { pages: 0, known: 0 },
                comics: { pages: 0, known: 0 },
            },
        }),
    );
    show();
    await screen.findByRole('list', { name: 'By category' });

    await userEvent.click(countBy('Count the categories by', 'By pages'));

    expect(card('By category').textContent).toContain('Pages known on 0 of 450 books');
    expect(card('By category').querySelectorAll('.statistics-ring__segment')).toHaveLength(0);
});
it('shows the dropped collections with the two others', async () => {
    library(
        statistics({
            collections: { finished: 14, unfinished: 23, dropped: 1, missingVolumes: 180 },
        }),
    );

    show();

    await screen.findByRole('heading', { name: 'Collections' });

    expect(card('Collections').textContent).toContain(
        'Finished14Unfinished23Dropped1180 volumes missing in total.',
    );
});
it('counts the dropped collections among the collections of the owned books', async () => {
    library(
        statistics({
            collections: { finished: 14, unfinished: 23, dropped: 1, missingVolumes: 180 },
        }),
    );

    show();

    await screen.findByRole('heading', { name: 'Owned books' });

    expect(card('Owned books').textContent).toContain('in 38 collections');
});
it('leaves out the reading of a Guest', async () => {
    library(statistics({ reading: null }), 'guest');

    show();

    await screen.findByRole('heading', { name: 'Owned books' });

    expect([
        screen.queryByRole('heading', { name: 'Read by you' }),
        screen.queryByRole('heading', { name: 'Your reading' }),
    ]).toEqual([null, null]);
});
const writers = statistics({
    authors: {
        byBooks: [
            { name: 'Eiichiro Oda', books: 62, pages: 1500 },
            { name: 'Victor Hugo', books: 1, pages: 1664 },
        ],
        byPages: [
            { name: 'Victor Hugo', books: 1, pages: 1664 },
            { name: 'Eiichiro Oda', books: 62, pages: 1500 },
        ],
    },
});

function authorRows() {
    return within(screen.getByRole('list', { name: 'Top authors' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent);
}

function authorChoice(name: string) {
    return within(screen.getByRole('group', { name: 'Rank the authors by' })).getByRole('radio', {
        name,
    });
}

it('starts the top authors on their number of books', async () => {
    library(writers);

    show();

    await screen.findByRole('list', { name: 'Top authors' });
    expect([authorChoice('By books'), authorRows()]).toEqual([
        expect.objectContaining({ checked: true }),
        ['1Eiichiro Oda62', '2Victor Hugo1'],
    ]);
});
it('ranks the authors by pages once chosen', async () => {
    library(writers);
    show();
    await screen.findByRole('list', { name: 'Top authors' });

    await userEvent.click(authorChoice('By pages'));

    expect(authorRows()).toEqual(['1Victor Hugo1,664', '2Eiichiro Oda1,500']);
});
it('ranks the publishers by pages once chosen', async () => {
    library();
    show();
    await screen.findByRole('list', { name: 'Top publishers' });

    await userEvent.click(
        within(screen.getByRole('group', { name: 'Rank the publishers by' })).getByRole('radio', {
            name: 'By pages',
        }),
    );

    expect(
        within(screen.getByRole('list', { name: 'Top publishers' }))
            .getAllByRole('listitem')
            .map((item) => item.textContent),
    ).toEqual(['1Kana21,000', '2Glénat18,000']);
});
it('says when there are fewer than ten publishers and how many books have none', async () => {
    library();

    show();

    await screen.findByRole('list', { name: 'Top publishers' });

    expect(card('Top publishers')).toHaveTextContent(
        'Only 2 publishers.22 books have no publisher.',
    );
});
it('ranks the authors by number of books', async () => {
    library();

    show();

    const ranking = await screen.findByRole('list', { name: 'Top authors' });

    expect(
        within(ranking)
            .getAllByRole('listitem')
            .map((item) => item.textContent),
    ).toEqual(['1Eiichiro Oda62']);
});
it('links each record to its book or collection', async () => {
    library();

    show();

    await screen.findByRole('heading', { name: 'Longest book' });

    expect(
        ['Open Les Misérables', 'Open Akira', 'Open One Piece'].map((name) =>
            screen.getByRole('link', { name }).getAttribute('href'),
        ),
    ).toEqual(['/books/b1', '/books/b2', '/collections/c1']);
    expect(card('Longest book')).toHaveTextContent('Victor Hugo · 1,664 pages');
});
it('hides a record that no book has', async () => {
    library(
        statistics({
            records: {
                longest: null,
                mostExpensive: null,
                biggestCollection: { id: 'c1', name: 'One Piece', ownedBooks: 62 },
            },
        }),
    );

    show();

    await screen.findByRole('heading', { name: 'Biggest collection' });

    expect(screen.queryByRole('heading', { name: 'Longest book' })).not.toBeInTheDocument();
});
it('asks for the category in the address', async () => {
    const api = library();

    show('/statistics?category=comics');

    await screen.findByRole('heading', { name: 'Owned books' });

    expect([
        api.calls.map((call) => call.route).filter((route) => route.includes('statistics')),
        screen.getByRole('radio', { name: 'Comics' }),
    ]).toEqual([['GET /statistics?category=comics'], expect.objectContaining({ checked: true })]);
});
it('writes the chosen category to the address and reloads the numbers', async () => {
    const api = library();
    const router = show();

    await screen.findByRole('heading', { name: 'Owned books' });
    await userEvent.click(screen.getByRole('radio', { name: 'Manga' }));
    await screen.findByRole('heading', { name: 'Owned books' });

    expect([
        router.state.location.search,
        api.calls.map((call) => call.route).filter((route) => route.includes('statistics')),
    ]).toEqual(['?category=manga', ['GET /statistics', 'GET /statistics?category=manga']]);
});
it('shows the empty state for a category without owned books', async () => {
    library(statistics({ ownedBooks: 0 }));

    show('/statistics?category=comics');

    expect(await screen.findByText('No owned book in Comics yet')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Comics' })).toBeInTheDocument();
});
it('shows the empty state for an empty library', async () => {
    library(statistics({ ownedBooks: 0 }));

    show();

    expect(await screen.findByText('No owned book yet')).toBeInTheDocument();
});
it('offers the views on the title line', async () => {
    library();

    show();

    const views = await screen.findByRole('radiogroup', { name: 'View' });

    expect(
        within(views)
            .getAllByRole('radio')
            .map((radio) => radio.textContent),
    ).toEqual(['Dashboard', 'Story', 'Topics']);
});
it('opens the view given in the address', async () => {
    library();

    show('/statistics?view=story');

    expect(await screen.findByRole('heading', { name: 'Your library' })).toBeInTheDocument();
});
it('switches the view and keeps the chosen category', async () => {
    const api = library();
    const router = show('/statistics?category=manga');

    await screen.findByRole('heading', { name: 'Owned books' });

    await userEvent.click(screen.getByRole('radio', { name: 'Story' }));

    expect([
        await screen.findByRole('heading', { name: 'Your library' }),
        new URLSearchParams(router.state.location.search).get('category'),
        api.calls.filter((call) => call.route.includes('statistics')).length,
    ]).toEqual([expect.anything(), 'manga', 1]);
});
it('opens the last view chosen on this browser', async () => {
    library();
    window.localStorage.setItem('media-collection.statistics-view', 'story');

    show();

    expect(await screen.findByRole('heading', { name: 'Your library' })).toBeInTheDocument();
});
it('falls back to the Dashboard for an unknown view', async () => {
    library();

    show('/statistics?view=unknown');

    expect(await screen.findByRole('heading', { name: 'Owned books' })).toBeInTheDocument();
});
it('formats numbers and money in French', async () => {
    deviceLanguages(['fr-FR']);
    library();

    show();

    await screen.findByRole('heading', { name: 'Livres possédés' });

    expect([
        card('Livres possédés').querySelector('.statistics-card__value')?.textContent,
        card('Prix total').querySelector('.statistics-card__value')?.textContent,
    ]).toEqual(['4 500', '3 284,50 €']);
});
