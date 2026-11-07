import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CollectionShoppingDto } from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { CollectionShoppingPage } from './collection-shopping-page';

function shopping(overrides: Partial<CollectionShoppingDto> = {}): CollectionShoppingDto {
    return {
        id: 'batman',
        name: 'Batman',
        finished: false,
        expectedCount: 12,
        ownedCount: 4,
        lastOwned: { volume: 4, title: null },
        missing: [
            { volume: 5, saved: false, quickAdd: null },
            { volume: 12, saved: true, quickAdd: { bookId: 'twelve', title: 'Batman Vol. 12' } },
        ],
        ...overrides,
    };
}

function withShopping(value: CollectionShoppingDto) {
    return new FakeApi()
        .signedIn(account())
        .on('GET /collections/batman/shopping', () => ({ status: 200, body: value }));
}

function open() {
    return renderRoute('/collections/batman', {
        '/collections/:id': <CollectionShoppingPage />,
    });
}

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('shows the last Owned volume and the missing volumes', async () => {
    withShopping(shopping());

    open();

    expect(await screen.findByRole('heading', { name: 'Batman' })).toBeInTheDocument();
    expect(screen.getByText('4 of 12 volumes Owned')).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
    expect(screen.getByText('Volume 5')).toBeInTheDocument();
    expect(screen.getByText('Not registered')).toBeInTheDocument();
    expect(screen.getByText('Saved · Not Owned')).toBeInTheDocument();
});

it('names the last Owned volume of a Books collection by its title', async () => {
    withShopping(shopping({ lastOwned: { volume: 2, title: 'Dune Messiah' } }));

    open();

    expect(await screen.findByText('Dune Messiah')).toBeInTheDocument();
});

it('says when no book is owned yet', async () => {
    withShopping(shopping({ lastOwned: null, ownedCount: 0 }));

    open();

    expect(await screen.findByText('No books owned yet')).toBeInTheDocument();
    expect(screen.queryByText('Last Owned volume')).not.toBeInTheDocument();
});

it('says when no volume is known to be missing', async () => {
    withShopping(shopping({ missing: [] }));

    open();

    expect(
        await screen.findByRole('heading', { name: 'No known missing volumes' }),
    ).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
});

it('offers no quick add for an inferred volume', async () => {
    withShopping(shopping());
    open();

    const entry = (await screen.findByText('Volume 5')).closest('li')!;

    expect(within(entry).queryByRole('button')).not.toBeInTheDocument();
});

it('asks for confirmation before marking a volume Owned', async () => {
    const api = withShopping(shopping());

    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Mark Volume 12 Owned' }));

    expect(screen.getByRole('dialog', { name: 'Mark Volume 12 Owned?' })).toBeInTheDocument();
    expect(screen.getByText('Batman · Volume 12 · Batman Vol. 12')).toBeInTheDocument();
    expect(api.calls.some((call) => call.route.startsWith('POST'))).toBe(false);
});

it('changes nothing when the confirmation is cancelled', async () => {
    const api = withShopping(shopping());

    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark Volume 12 Owned' }));
    const dialog = screen.getByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls.some((call) => call.route.startsWith('POST'))).toBe(false);
});

it('marks the saved book Owned once confirmed', async () => {
    const api = withShopping(shopping()).on('POST /books/twelve/owned', () => ({
        status: 200,
        body: {},
    }));

    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark Volume 12 Owned' }));
    api.on('GET /collections/batman/shopping', () => ({
        status: 200,
        body: shopping({ missing: [{ volume: 5, saved: false, quickAdd: null }] }),
    }));

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Owned' }));

    expect(await screen.findByText('Volume 12 is now Owned.')).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).toContain('POST /books/twelve/owned');
    expect(screen.queryByText('Volume 12')).not.toBeInTheDocument();
});

it('keeps the confirmation open with the reason when marking fails', async () => {
    withShopping(shopping()).on('POST /books/twelve/owned', () => ({
        status: 409,
        body: { code: 'conflict', reason: 'book-already-owned', message: 'Owned' },
    }));
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark Volume 12 Owned' }));

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Owned' }));

    expect(await screen.findByText('This book is already Owned.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Mark Volume 12 Owned?' })).toBeInTheDocument();
});

it('says when the collection has been marked Finished meanwhile', async () => {
    withShopping(shopping({ finished: true, missing: [] }));

    open();

    expect(
        await screen.findByText(
            'This collection is marked Finished, so it is no longer listed for shopping.',
        ),
    ).toBeInTheDocument();
});
