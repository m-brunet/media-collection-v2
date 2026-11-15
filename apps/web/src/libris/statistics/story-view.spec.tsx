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

function story(path = '/statistics?view=story') {
    show(path);

    return screen.findByRole('heading', { name: 'Your library' });
}

function sentence(section: string) {
    return card(section).querySelector('.statistics-story__sentence')?.textContent;
}

it('tells how many books are owned, split by category', async () => {
    library();

    await story();

    expect([
        sentence('Your library'),
        within(card('Your library'))
            .getAllByRole('listitem')
            .map((item) => item.textContent),
    ]).toEqual(['You own 4,500 books.', ['Manga268 · 60%', 'Comics97 · 22%', 'Books85 · 19%']]);
});
it('tells the share of the chosen category and dims the others', async () => {
    library(statistics({ ownedBooks: 268 }));

    await story('/statistics?view=story&category=manga');

    expect([
        sentence('Your library'),
        card('Your library').textContent,
        within(card('Your library'))
            .getAllByRole('listitem')
            .map((item) => item.classList.contains('statistics-legend--dimmed')),
    ]).toEqual([
        'You own 268 manga.',
        expect.stringContaining('That is 60% of your 450 books.'),
        [false, true, true],
    ]);
});
it('tells the pages with the books counted and the longest book', async () => {
    library();

    await story();

    expect([sentence('Pages'), card('Pages').textContent]).toEqual([
        'Together they hold 96,420 pages.',
        expect.stringContaining(
            'Counted on 412 of 4,500 books. 4,088 have no page count.Longest book',
        ),
    ]);
});
it('tells the total price and links the books without a price', async () => {
    library();

    await story();

    expect([
        sentence('Total price'),
        screen.getByRole('link', { name: 'See the 4,102 books without a price' }),
        within(card('Total price')).getByRole('heading', { name: 'Most expensive book' }),
    ]).toEqual(['They cost €3,284.50 in total.', expect.anything(), expect.anything()]);
});
it('tells a single book in the singular', async () => {
    library(
        statistics({
            ownedBooks: 1,
            categories: { books: 1, manga: 0, comics: 0 },
            reading: { read: 1, notRead: 0 },
            pages: { total: 1, known: 1 },
            price: { totalCents: 990, known: 1 },
            collections: { finished: 1, unfinished: 0, missingVolumes: 1 },
        }),
    );

    await story();

    expect(
        ['Your library', 'Pages', 'Total price', 'Your reading', 'Collections'].map(sentence),
    ).toEqual([
        'You own 1 book.',
        'It holds 1 page.',
        'It cost €9.90.',
        'You have read it.',
        'Your only collection is finished.',
    ]);
});
it('tells the reading of the signed-in person', async () => {
    library();

    await story();

    expect(sentence('Your reading')).toBe('You have read 312 of them.');
});
it('leaves out the reading of a Guest', async () => {
    library(statistics({ reading: null }), 'guest');

    await story();

    expect(screen.queryByRole('heading', { name: 'Your reading' })).not.toBeInTheDocument();
});
it('names the top publisher and the top author', async () => {
    library();

    await story();

    expect(sentence('Publishers and authors')).toBe(
        'Glénat published the most of your books, and Eiichiro Oda wrote the most.',
    );
});
it('ranks the publishers by pages once chosen', async () => {
    library();
    await story();

    await userEvent.click(screen.getByRole('radio', { name: 'By pages' }));

    expect(
        within(screen.getByRole('list', { name: 'Top publishers' }))
            .getAllByRole('listitem')
            .map((item) => item.textContent),
    ).toEqual(['1Kana21,000', '2Glénat18,000']);
});
it('tells how many collections are finished and the missing volumes', async () => {
    library();

    await story();

    expect([sentence('Collections'), card('Collections').textContent]).toEqual([
        '14 of your 38 collections are finished.',
        expect.stringContaining('187 volumes are still missing.'),
    ]);
});
it('leaves out the sections without data', async () => {
    library(
        statistics({
            pages: { total: 0, known: 0 },
            price: { totalCents: 0, known: 0 },
            publishers: { byBooks: [], byPages: [], without: 3, count: 0 },
            authors: { byBooks: [], byPages: [] },
            collections: { finished: 0, unfinished: 0, missingVolumes: 0 },
        }),
    );

    await story();

    expect(
        screen
            .getAllByRole('heading', { level: 2 })
            .map((heading) => heading.textContent)
            .filter((name) => name !== 'Statistics'),
    ).toEqual(['Your library', 'Your reading']);
});
