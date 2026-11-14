import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { StatisticsDto } from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { Required } from '../../shared/required.util';
import { renderRoute } from '../../testing/render-route.test-support';
import { StatisticsPage } from './statistics-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function statistics(overrides: Partial<StatisticsDto> = {}): StatisticsDto {
    return {
        ownedBooks: 4500,
        singleBooks: 61,
        categories: { books: 85, manga: 268, comics: 97 },
        reading: { read: 312, notRead: 138 },
        pages: { total: 96420, known: 412 },
        price: { totalCents: 328450, known: 398 },
        publishers: {
            byBooks: [
                { name: 'Glénat', books: 96, pages: 18000 },
                { name: 'Kana', books: 61, pages: 21000 },
            ],
            byPages: [
                { name: 'Kana', books: 61, pages: 21000 },
                { name: 'Glénat', books: 96, pages: 18000 },
            ],
            without: 22,
            count: 2,
        },
        authors: [{ name: 'Eiichiro Oda', books: 62 }],
        records: {
            longest: { id: 'b1', title: 'Les Misérables', authors: ['Victor Hugo'], value: 1664 },
            mostExpensive: { id: 'b2', title: 'Akira', authors: ['Katsuhiro Otomo'], value: 14900 },
            biggestCollection: { id: 'c1', name: 'One Piece', ownedBooks: 62 },
        },
        collections: { finished: 14, unfinished: 24, missingVolumes: 187 },
        ...overrides,
    };
}

function library(body: StatisticsDto = statistics(), role: 'owner' | 'guest' = 'owner') {
    return new FakeApi()
        .signedIn(account({ role }))
        .on('GET /statistics', () => ({ status: 200, body }));
}

function show(path = '/statistics') {
    return renderRoute(path, { '/statistics': <StatisticsPage /> });
}

function card(name: string) {
    return Required.value(
        screen.getByRole('heading', { name }).closest('section'),
        'each statistic is a section under its heading',
    );
}

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
it('leaves out the reading of a Guest', async () => {
    library(statistics({ reading: null }), 'guest');

    show();

    await screen.findByRole('heading', { name: 'Owned books' });

    expect([
        screen.queryByRole('heading', { name: 'Read by you' }),
        screen.queryByRole('heading', { name: 'Your reading' }),
    ]).toEqual([null, null]);
});
it('ranks the publishers by pages once chosen', async () => {
    library();
    show();
    await screen.findByRole('list', { name: 'Top publishers' });

    await userEvent.click(screen.getByRole('radio', { name: 'By pages' }));

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
it('hides the view choice while the page has a single view', async () => {
    library();

    show('/statistics?view=story');

    await screen.findByRole('heading', { name: 'Owned books' });

    expect(screen.queryByRole('group', { name: 'View' })).not.toBeInTheDocument();
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
