import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TagDto } from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { FiltersPage } from './filters-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const tags: TagDto[] = [
    { id: 'adventure', name: 'Adventure', bookCount: 3 },
    { id: 'fantasy', name: 'Fantasy', bookCount: 5 },
    { id: 'medieval', name: 'Medieval', bookCount: 2 },
];

function api(role: 'owner' | 'guest' = 'owner') {
    return new FakeApi()
        .signedIn(account({ role }))
        .on('GET /tags', () => ({ status: 200, body: tags }))
        .on('GET /bookcases', () => ({
            status: 200,
            body: [
                {
                    id: 'oak',
                    name: 'Oak bookcase',
                    bookCount: 2,
                    shelves: [{ id: 's3', bookcaseId: 'oak', name: 'Shelf 3', bookCount: 2 }],
                },
            ],
        }))
        .on('GET /authors', () => ({ status: 200, body: [] }))
        .on('GET /collections/names', () => ({ status: 200, body: [] }));
}

function show(path: string) {
    return renderRoute(path, {
        '/books/filters': <FiltersPage listing="books" />,
        '/collections/filters': <FiltersPage listing="collections" />,
    });
}

function tagChoice(name: string, choice: 'None' | 'Include' | 'Exclude') {
    return within(screen.getByRole('radiogroup', { name })).getByRole('radio', { name: choice });
}

it('returns to My books with the combined criteria, keeping the search', async () => {
    api();
    const router = show('/books/filters?search=tolk');

    await screen.findByRole('radiogroup', { name: 'Fantasy' });
    await userEvent.click(screen.getByText('Any category'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Manga' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Comics' }));
    await userEvent.click(screen.getByText('Any bookcase / shelf'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'No physical location' }));
    await userEvent.click(tagChoice('Fantasy', 'Include'));
    await userEvent.click(tagChoice('Medieval', 'Exclude'));

    await userEvent.click(screen.getByRole('button', { name: 'Show results' }));

    expect(router.state.location.pathname).toBe('/books');
    expect(router.state.location.search).toBe(
        '?search=tolk&category=manga&category=comics&location=none&tag=fantasy&notTag=medieval',
    );
});

it('summarises the chosen tags and resets them together', async () => {
    api();
    show('/books/filters?tag=fantasy&notTag=medieval');
    await screen.findByRole('button', { name: 'Remove the filter Include: Fantasy' });

    await userEvent.click(screen.getByRole('button', { name: 'Reset tags' }));

    expect(tagChoice('Fantasy', 'None')).toBeChecked();
    expect(tagChoice('Medieval', 'None')).toBeChecked();
});

it('shows only the chosen tags under Selected', async () => {
    api();
    show('/books/filters?tag=fantasy');
    await screen.findByRole('radiogroup', { name: 'Adventure' });

    await userEvent.click(screen.getByRole('button', { name: 'Selected (1)' }));

    expect(screen.getByRole('radiogroup', { name: 'Fantasy' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Adventure' })).not.toBeInTheDocument();
});

it('clears every choice on the page', async () => {
    api();
    const router = show('/books/filters?ownership=owned&tag=fantasy');

    await screen.findByRole('radiogroup', { name: 'Fantasy' });
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await userEvent.click(screen.getByRole('button', { name: 'Show results' }));

    expect(router.state.location.search).toBe('');
});

it('offers the reading status to account holders only', async () => {
    api('guest');

    show('/books/filters');

    expect(await screen.findByText('Ownership')).toBeInTheDocument();
    expect(screen.queryByText('Your reading status')).not.toBeInTheDocument();
});

it('has no collection field for the Collections list', async () => {
    api();

    show('/collections/filters');

    expect(
        await screen.findByText(
            'A collection is shown when one of its books matches every criterion.',
        ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Any collection')).not.toBeInTheDocument();
});
