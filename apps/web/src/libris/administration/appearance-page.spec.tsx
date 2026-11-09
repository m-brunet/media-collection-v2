import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../../shared/appearance/appearance-context';
import { SessionProvider } from '../../shared/session/session-context';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { AppearancePage } from './appearance-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function renderPage() {
    render(
        <AppearanceProvider>
            <SessionProvider>
                <AppearancePage />
            </SessionProvider>
        </AppearanceProvider>,
    );
}

function administrator() {
    return new FakeApi().signedIn(account({ role: 'admin' }));
}

it('offers the eight colour schemes with Spring green as the default', async () => {
    administrator();

    renderPage();

    expect(await screen.findByRole('radio', { name: /Spring green/ })).toBeChecked();
    expect(
        within(screen.getByRole('group', { name: 'Colour scheme' })).getAllByRole('radio'),
    ).toHaveLength(8);
    expect(screen.getByRole('radio', { name: /Midnight blue/ })).not.toBeChecked();
});

it('applies the installation scheme when the page loads', async () => {
    administrator().on('GET /appearance', () => ({
        status: 200,
        body: { colorScheme: 'rose-noir' },
    }));

    renderPage();

    await waitFor(() => expect(document.documentElement.dataset.colorScheme).toBe('rose-noir'));
});

it('saves a scheme for everyone as soon as it is chosen', async () => {
    const api = administrator().on('PUT /appearance', () => ({
        status: 200,
        body: { colorScheme: 'midnight-blue' },
    }));

    renderPage();

    await userEvent.click(await screen.findByRole('radio', { name: /Midnight blue/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('Colour scheme saved.');
    expect(document.documentElement.dataset.colorScheme).toBe('midnight-blue');
    expect(api.calls).toContainEqual({
        route: 'PUT /appearance',
        body: { colorScheme: 'midnight-blue' },
    });
});

it('has no separate save button', async () => {
    administrator();

    renderPage();

    await screen.findByRole('radio', { name: /Midnight blue/ });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('restores the previous scheme and explains a refused change', async () => {
    administrator().on('PUT /appearance', () => ({
        status: 403,
        body: { code: 'forbidden', reason: 'admin-only', message: 'No' },
    }));

    renderPage();

    await userEvent.click(await screen.findByRole('radio', { name: /Ember/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
        'Only the administrator can do this.',
    );
    expect(screen.getByRole('radio', { name: /Spring green/ })).toBeChecked();
});

it('offers the six icon sets with Lucide as the default', async () => {
    administrator();

    renderPage();

    const group = await screen.findByRole('group', { name: 'Icon set' });

    expect(within(group).getAllByRole('radio')).toHaveLength(6);
    expect(within(group).getByRole('radio', { name: /Lucide/ })).toBeChecked();
});
it('saves an icon set for everyone as soon as it is chosen', async () => {
    const api = administrator().on('PUT /appearance/icon-set', () => ({
        status: 200,
        body: { iconSet: 'hand-inked-editorial' },
    }));

    renderPage();
    const group = await screen.findByRole('group', { name: 'Icon set' });

    await userEvent.click(within(group).getByRole('radio', { name: /Hand-inked editorial/ }));

    expect(await screen.findByText(/Icon set saved/)).toBeInTheDocument();
    expect(api.calls).toContainEqual({
        route: 'PUT /appearance/icon-set',
        body: { iconSet: 'hand-inked-editorial' },
    });
});
it('previews each icon set with its own icons', async () => {
    administrator();

    renderPage();
    const group = await screen.findByRole('group', { name: 'Icon set' });

    await waitFor(() =>
        expect(group.querySelectorAll('[data-icon-set="solid-silhouettes"]').length).toBe(5),
    );
});
