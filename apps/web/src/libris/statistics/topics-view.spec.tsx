import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deviceLanguages } from '../../testing/fake-api.test-support';
import { library, show, statistics } from './statistics-fixtures.test-support';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

async function topics(path = '/statistics?view=topics') {
    const router = show(path);

    return { router, menu: await screen.findByRole('group', { name: 'Topics' }) };
}

function cards(menu: HTMLElement) {
    return within(menu)
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent);
}

function panel() {
    return screen.getByRole('heading', { level: 2 }).closest('section');
}

it('shows the seven topics with their headline values', async () => {
    library();

    const { menu } = await topics();

    expect(cards(menu)).toEqual([
        'Owned books4,500Manga 268 · Comics 97 · Books 85',
        'Pages96,420on 412 of 4,500 books',
        'Total price€3,284.50on 398 of 4,500 books',
        'Read by you31269% · 138 left to read',
        'Top publisherGlénat96 books · 18,000 pages',
        'Top authorEiichiro Oda62 books',
        'Finished collections14 of 38187 volumes missing',
    ]);
});
it('opens on the first topic', async () => {
    library();

    await topics();

    expect([screen.getByRole('radio', { name: /^Owned books/ }), panel()?.textContent]).toEqual([
        expect.objectContaining({ checked: true }),
        expect.stringContaining('You own 4,500 books.'),
    ]);
});
it('shows the panel of the chosen topic and writes it to the address', async () => {
    library();
    const { router } = await topics();

    await userEvent.click(screen.getByRole('radio', { name: /^Top author/ }));

    expect([panel()?.textContent, router.state.location.search]).toEqual([
        expect.stringContaining('Eiichiro Oda wrote the most of your books.'),
        '?view=topics&topic=authors',
    ]);
});
it('moves to the next topic with the arrow keys', async () => {
    library();
    await topics();
    await userEvent.click(screen.getByRole('radio', { name: /^Owned books/ }));

    await userEvent.keyboard('{ArrowDown}');

    expect(panel()?.textContent).toContain('Together they hold 96,420 pages.');
});
it('reads the topic from the address', async () => {
    library();

    await topics('/statistics?view=topics&topic=collections');

    expect(panel()?.textContent).toContain('14 of your 38 collections are finished.');
});
it('falls back to the first topic for an unknown one', async () => {
    library();

    await topics('/statistics?view=topics&topic=unknown');

    expect(screen.getByRole('radio', { name: /^Owned books/ })).toBeChecked();
});
it('offers no reading topic to a Guest', async () => {
    library(statistics({ reading: null }), 'guest');

    const { menu } = await topics();

    expect(within(menu).queryByRole('radio', { name: /^Read by you/ })).not.toBeInTheDocument();
});
it('shows the books and the pages of each publisher side by side', async () => {
    library();

    await topics('/statistics?view=topics&topic=publishers');

    expect(
        within(screen.getByRole('table', { name: 'Top publishers' }))
            .getAllByRole('row')
            .slice(1)
            .map((row) => row.textContent),
    ).toEqual(['1Glénat9618,000', '2Kana6121,000']);
});
it('gives the share of the chosen category on the first card', async () => {
    library(statistics({ ownedBooks: 268 }));

    const { menu } = await topics('/statistics?view=topics&category=manga');

    expect(cards(menu)[0]).toBe('Owned books26860% of your 450 books');
});
it('shows a dash and an empty panel for a topic without data', async () => {
    library(statistics({ authors: [] }));

    const { menu } = await topics('/statistics?view=topics&topic=authors');

    expect([cards(menu)[5], panel()?.textContent]).toEqual([
        'Top author—Nothing to count yet',
        expect.stringContaining('There is nothing to show here yet.'),
    ]);
});
