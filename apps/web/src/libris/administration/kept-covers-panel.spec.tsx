import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '../../shared/session/session-context';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { KeptCoversPanel } from './kept-covers-panel';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function administrator(summary: { count: number; bytes: number; oldestKeptAt: string | null }) {
    return new FakeApi()
        .signedIn(account({ id: 'admin', username: 'alex', role: 'admin' }))
        .on('GET /maintenance/kept-covers/summary', () => ({ status: 200, body: summary }));
}

const many = { count: 437, bytes: 52 * 1024 * 1024, oldestKeptAt: '2026-03-12T09:00:00.000Z' };

function renderPanel(onDeleted = vi.fn()) {
    render(
        <SessionProvider>
            <KeptCoversPanel onDeleted={onDeleted} />
        </SessionProvider>,
    );

    return onDeleted;
}

it('shows how many covers are kept, their size and the oldest date', async () => {
    administrator(many);

    renderPanel();

    expect(await screen.findByText('437 covers kept · 52 MB')).toBeInTheDocument();
    expect(screen.getByText(/The oldest was kept on 12 March 2026\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete kept covers' })).toBeEnabled();
});

it('words a single kept cover', async () => {
    administrator({ count: 1, bytes: 180 * 1024, oldestKeptAt: '2026-03-12T09:00:00.000Z' });

    renderPanel();

    expect(await screen.findByText('1 cover kept · 180 kB')).toBeInTheDocument();
});

it('says nothing is kept and offers no deletion', async () => {
    administrator({ count: 0, bytes: 0, oldestKeptAt: null });

    renderPanel();

    expect(await screen.findByText(/No cover is kept\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete kept covers' })).not.toBeInTheDocument();
});

it('shows nothing while the summary cannot be read', async () => {
    const api = new FakeApi().signedIn(account({ role: 'admin' }));

    renderPanel();
    await vi.waitFor(() =>
        expect(api.calls.map((call) => call.route)).toContain(
            'GET /maintenance/kept-covers/summary',
        ),
    );

    expect(screen.queryByText('Kept covers')).not.toBeInTheDocument();
});

it('asks for a confirmation that names the number and the size', async () => {
    administrator(many);
    renderPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete kept covers' }));

    const dialog = screen.getByRole('dialog', { name: 'Delete the kept covers?' });

    expect(
        within(dialog).getByText(/The 437 kept covers \(52 MB\) will be deleted\./),
    ).toBeInTheDocument();
});

it('deletes nothing when the confirmation is cancelled', async () => {
    const api = administrator(many);

    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete kept covers' }));

    await userEvent.click(
        within(screen.getByRole('dialog', { name: 'Delete the kept covers?' })).getByRole(
            'button',
            { name: 'Cancel' },
        ),
    );

    expect(api.calls.map((call) => call.route)).not.toContain('DELETE /maintenance/kept-covers');
});

it('deletes the kept covers, reports their number and shows that nothing is kept', async () => {
    administrator(many).on('DELETE /maintenance/kept-covers', () => ({
        status: 200,
        body: { deleted: 437 },
    }));
    const onDeleted = renderPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete kept covers' }));

    await userEvent.click(
        within(screen.getByRole('dialog', { name: 'Delete the kept covers?' })).getByRole(
            'button',
            { name: 'Delete kept covers' },
        ),
    );

    expect(await screen.findByText(/No cover is kept\./)).toBeInTheDocument();
    expect(onDeleted).toHaveBeenCalledWith(437);
});

it('shows a refused deletion in the dialog and keeps the panel', async () => {
    administrator(many).on('DELETE /maintenance/kept-covers', () => ({
        status: 403,
        body: { code: 'forbidden', message: 'Forbidden' },
    }));
    const onDeleted = renderPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete kept covers' }));

    await userEvent.click(
        within(screen.getByRole('dialog', { name: 'Delete the kept covers?' })).getByRole(
            'button',
            { name: 'Delete kept covers' },
        ),
    );

    expect(
        await within(screen.getByRole('dialog', { name: 'Delete the kept covers?' })).findByRole(
            'alert',
        ),
    ).toBeInTheDocument();
    expect(screen.getByText('437 covers kept · 52 MB')).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
});
