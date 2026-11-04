import { render, screen, waitFor } from '@testing-library/react';
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

it('offers the four colour schemes with Spring green as the default', async () => {
    administrator();

    renderPage();

    expect(await screen.findByRole('radio', { name: /Spring green/ })).toBeChecked();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: /Mint/ })).not.toBeChecked();
});

it('applies the installation scheme when the page loads', async () => {
    administrator().on('GET /appearance', () => ({ status: 200, body: { colorScheme: 'forest' } }));

    renderPage();

    await waitFor(() => expect(document.documentElement.dataset.colorScheme).toBe('forest'));
});

it('saves a new scheme for everyone and applies it at once', async () => {
    const api = administrator().on('PUT /appearance', () => ({
        status: 200,
        body: { colorScheme: 'mint' },
    }));

    renderPage();
    await userEvent.click(await screen.findByRole('radio', { name: /Mint/ }));

    await userEvent.click(screen.getByRole('button', { name: 'Save colour scheme' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Colour scheme saved.');
    expect(document.documentElement.dataset.colorScheme).toBe('mint');
    expect(api.calls).toContainEqual({ route: 'PUT /appearance', body: { colorScheme: 'mint' } });
});

it('offers nothing to save until another scheme is chosen', async () => {
    administrator();

    renderPage();

    expect(await screen.findByRole('button', { name: 'Save colour scheme' })).toBeDisabled();
});

it('explains a refused change', async () => {
    administrator().on('PUT /appearance', () => ({
        status: 403,
        body: { code: 'forbidden', reason: 'admin-only', message: 'No' },
    }));

    renderPage();
    await userEvent.click(await screen.findByRole('radio', { name: /Emerald/ }));

    await userEvent.click(screen.getByRole('button', { name: 'Save colour scheme' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
        'Only the administrator can do this.',
    );
});
