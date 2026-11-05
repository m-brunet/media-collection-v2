import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TagDto } from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { TagsPage } from './tags-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const tags: TagDto[] = [
    { id: 't1', name: 'Fantasy', bookCount: 86 },
    { id: 't2', name: 'Médiéval', bookCount: 1 },
    { id: 't3', name: 'To explore', bookCount: 0 },
];

function show() {
    return renderRoute('/tags', { '/tags': <TagsPage /> });
}

function row(name: string) {
    return screen.getByText(name).closest('li')!;
}

it('lists every tag with the number of its books', async () => {
    new FakeApi().signedIn(account()).on('GET /tags', () => ({ status: 200, body: tags }));

    show();

    expect(await screen.findByText('Fantasy')).toBeInTheDocument();
    expect(row('Fantasy')).toHaveTextContent('86 books');
    expect(row('Médiéval')).toHaveTextContent('1 book');
    expect(row('To explore')).toHaveTextContent('0 books');
});

it('finds a tag ignoring case and accents', async () => {
    new FakeApi().signedIn(account()).on('GET /tags', () => ({ status: 200, body: tags }));
    show();
    await screen.findByText('Fantasy');

    await userEvent.type(screen.getByLabelText('Find a tag'), 'MEDIE');

    expect(screen.getByText('Médiéval')).toBeInTheDocument();
    expect(screen.queryByText('Fantasy')).not.toBeInTheDocument();
});

it('creates a tag and lists it', async () => {
    let saved = tags;
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /tags', () => ({ status: 200, body: saved }))
        .on('POST /tags', () => {
            saved = [...tags, { id: 't4', name: 'Adventure', bookCount: 0 }];

            return { status: 201, body: { id: 't4', name: 'Adventure', bookCount: 0 } };
        });

    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Create tag' }));
    const dialog = screen.getByRole('dialog', { name: 'Create tag' });

    await userEvent.type(within(dialog).getByLabelText(/Tag name/), 'Adventure');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create tag' }));

    expect(await screen.findByText('“Adventure” was created.')).toBeInTheDocument();
    expect(api.calls).toContainEqual({ route: 'POST /tags', body: { name: 'Adventure' } });
    expect(screen.getByText('Adventure')).toBeInTheDocument();
});

it('keeps the rename dialog open with the reason when the name is taken', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /tags', () => ({ status: 200, body: tags }))
        .on('PATCH /tags/t3', () => ({
            status: 409,
            body: { message: 'Taken', reason: 'tag-name-taken' },
        }));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Rename To explore' }));
    const dialog = screen.getByRole('dialog', { name: 'Rename tag' });

    await userEvent.clear(within(dialog).getByLabelText(/Tag name/));
    await userEvent.type(within(dialog).getByLabelText(/Tag name/), 'fantasy');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save tag' }));

    expect(
        await within(dialog).findByText(
            'Another tag already has an equivalent name. Merging tags is not available.',
        ),
    ).toBeInTheDocument();
});

it('tells how many books lose a tag before deleting it', async () => {
    new FakeApi().signedIn(account()).on('GET /tags', () => ({ status: 200, body: tags }));
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Fantasy' }));

    expect(
        within(screen.getByRole('dialog', { name: 'Delete Fantasy?' })).getByText(
            'This removes the tag from 86 books. The books themselves will be kept.',
        ),
    ).toBeInTheDocument();
});

it('deletes a tag once confirmed', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /tags', () => ({ status: 200, body: tags }))
        .on('DELETE /tags/t1', () => ({ status: 204 }));

    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Fantasy' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Fantasy?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete tag' }));

    expect(
        await screen.findByText('“Fantasy” was deleted. Its books were kept.'),
    ).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).toContain('DELETE /tags/t1');
});

it('shows a Guest the tags without managing them', async () => {
    new FakeApi()
        .signedIn(account({ role: 'guest' }))
        .on('GET /tags', () => ({ status: 200, body: tags }));

    show();

    expect(await screen.findByText('Fantasy')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create tag' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Fantasy' })).not.toBeInTheDocument();
});

it('invites to create the first tag', async () => {
    new FakeApi().signedIn(account()).on('GET /tags', () => ({ status: 200, body: [] }));

    show();

    expect(
        await screen.findByText('No tags yet. Create one here, or while editing a book.'),
    ).toBeInTheDocument();
});
