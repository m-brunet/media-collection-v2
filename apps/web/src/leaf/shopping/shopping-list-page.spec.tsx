import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ShoppingCollectionDto } from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { ShoppingListPage } from './shopping-list-page';

function collection(overrides: Partial<ShoppingCollectionDto>): ShoppingCollectionDto {
    return {
        id: 'batman',
        name: 'Batman',
        expectedCount: 12,
        ownedCount: 4,
        missingCount: 8,
        lastOwned: 4,
        ...overrides,
    };
}

function withCollections(items: ShoppingCollectionDto[]) {
    return new FakeApi()
        .signedIn(account())
        .on('GET /collections/shopping', () => ({ status: 200, body: items }));
}

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('lists each collection with its missing count and last Owned volume', async () => {
    withCollections([collection({})]);

    renderRoute('/collections', { '/collections': <ShoppingListPage /> });

    expect(await screen.findByRole('link', { name: /Batman/ })).toHaveAttribute(
        'href',
        '/collections/batman',
    );
    expect(screen.getByText('8 missing · Last Owned: 4')).toBeInTheDocument();
});

it('says when a collection has no known missing volume', async () => {
    withCollections([collection({ missingCount: 0, lastOwned: 3 })]);

    renderRoute('/collections', { '/collections': <ShoppingListPage /> });

    expect(await screen.findByText('No known missing volumes')).toBeInTheDocument();
});

it('says when no book of a collection is owned yet', async () => {
    withCollections([collection({ missingCount: 3, lastOwned: null, ownedCount: 0 })]);

    renderRoute('/collections', { '/collections': <ShoppingListPage /> });

    expect(await screen.findByText('3 missing · No books owned yet')).toBeInTheDocument();
});

it('explains an empty list', async () => {
    withCollections([]);

    renderRoute('/collections', { '/collections': <ShoppingListPage /> });

    expect(await screen.findByText('No unfinished collections')).toBeInTheDocument();
    expect(screen.getByText('Finished collections are hidden here.')).toBeInTheDocument();
});

it('offers Retry when the collections cannot be loaded', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /collections/shopping', () => ({ status: 500, body: { message: 'Failed' } }));

    renderRoute('/collections', { '/collections': <ShoppingListPage /> });
    await screen.findByRole('alert');
    api.on('GET /collections/shopping', () => ({ status: 200, body: [collection({})] }));

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('8 missing · Last Owned: 4')).toBeInTheDocument();
});
