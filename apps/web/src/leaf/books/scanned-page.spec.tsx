import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BookLookupDto } from '../../../../../packages/contracts/src/http';
import { bookDto } from '../../testing/book-fixtures.test-support';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { ScannedPage } from './scanned-page';

const isbn = '9781635575637';

function lookedUp(overrides: Partial<Extract<BookLookupDto, { kind: 'looked-up' }>> = {}) {
    return {
        kind: 'looked-up' as const,
        isbn13: isbn,
        found: true,
        fields: {
            title: [{ value: 'Piranesi', sources: ['bnf'] }],
            authors: [],
            publisher: [],
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

function lookups(api: FakeApi, ...answers: { status: number; body?: unknown }[]) {
    return api.on('POST /books/lookups', () => answers.shift() ?? { status: 500 });
}

function open() {
    return renderRoute(
        { pathname: '/scan/found', state: { isbn } },
        { '/scan/found': <ScannedPage /> },
    );
}

function lookupCalls(api: FakeApi) {
    return api.calls.filter((call) => call.route === 'POST /books/lookups');
}

let api: FakeApi;

beforeEach(() => {
    deviceLanguages(['en-GB']);
    api = new FakeApi().signedIn(account());
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('returns home when opened without a scan', async () => {
    renderRoute('/scan/found', { '/scan/found': <ScannedPage /> });

    expect(await screen.findByText('Elsewhere: /')).toBeInTheDocument();
});

it('shows the scanned ISBN and looks nothing up before Find book', async () => {
    open();

    expect(await screen.findByText(isbn)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find book' })).toBeInTheDocument();
    expect(lookupCalls(api)).toEqual([]);
});

it('says an Owned ISBN is already owned, without creating anything', async () => {
    lookups(api, { status: 200, body: { kind: 'existing', bookId: 'b1' } });
    api.on('GET /books/b1', () => ({ status: 200, body: bookDto() }));
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Find book' }));

    expect(await screen.findByRole('heading', { name: 'Already owned' })).toBeInTheDocument();
    expect(screen.getByText('Piranesi · Susanna Clarke')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan another book' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).not.toContain('POST /books');
});

it('warns that a Not Owned ISBN is already registered and offers Mark as Owned', async () => {
    lookups(api, { status: 200, body: { kind: 'existing', bookId: 'b1' } });
    api.on('GET /books/b1', () => ({ status: 200, body: bookDto({ ownership: 'not-owned' }) }));
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Find book' }));

    expect(await screen.findByRole('heading', { name: 'Already registered' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as Owned' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).not.toContain('POST /books/b1/owned');
});

it('marks a registered Not Owned book Owned when asked', async () => {
    lookups(api, { status: 200, body: { kind: 'existing', bookId: 'b1' } });
    api.on('GET /books/b1', () => ({ status: 200, body: bookDto({ ownership: 'not-owned' }) }));
    api.on('POST /books/b1/owned', () => ({ status: 200, body: bookDto() }));
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Find book' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Mark as Owned' }));

    expect(await screen.findByRole('heading', { name: 'Now Owned' })).toBeInTheDocument();
    expect(screen.getByText('“Piranesi” is now Owned.')).toBeInTheDocument();
    expect(lookupCalls(api)).toHaveLength(1);
});

it('opens the review form with what the sources found', async () => {
    lookups(api, { status: 200, body: lookedUp() });
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Find book' }));

    expect(await screen.findByText('Elsewhere: /add')).toBeInTheDocument();
});

it('offers one Retry when no source knows the ISBN, without retrying by itself', async () => {
    lookups(api, { status: 200, body: lookedUp({ found: false }) });
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Find book' }));

    expect(
        await screen.findByRole('heading', { name: 'Could not find book details' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No book catalogue knows this ISBN.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(lookupCalls(api)).toHaveLength(1);
});

it('names the sources that could not be reached', async () => {
    lookups(api, {
        status: 200,
        body: lookedUp({ found: false, unavailable: [{ source: 'bnf', reason: 'failed' }] }),
    });
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Find book' }));

    expect(
        await screen.findByText('The lookup did not complete: BnF could not be reached.'),
    ).toBeInTheDocument();
});

it('ends with Back to home only when the retry fails too', async () => {
    lookups(api, { status: 500 }, { status: 500 });
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Find book' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'Lookup unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(lookupCalls(api)).toHaveLength(2);
});

it('opens the review form when the retry succeeds', async () => {
    lookups(api, { status: 500 }, { status: 200, body: lookedUp() });
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Find book' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Elsewhere: /add')).toBeInTheDocument();
});
