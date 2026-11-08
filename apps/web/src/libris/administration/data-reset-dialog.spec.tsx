import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '../../shared/session/session-context';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { DataResetDialog } from './data-reset-dialog';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function signedInAdministrator() {
    return new FakeApi().signedIn(account({ id: 'admin', username: 'alex', role: 'admin' }));
}

function renderDialog(onReset = vi.fn(), onClose = vi.fn()) {
    render(
        <SessionProvider>
            <DataResetDialog open onClose={onClose} onReset={onReset} />
        </SessionProvider>,
    );

    return screen.getByRole('dialog', { name: 'Reset application data' });
}

async function confirmed(dialog: HTMLElement, password: string) {
    await userEvent.type(within(dialog).getByLabelText(/^Current Admin password/), password);
    await userEvent.click(
        within(dialog).getByRole('checkbox', { name: 'I understand this cannot be undone' }),
    );
}

it('explains what is erased and what is kept', () => {
    signedInAdministrator();

    const dialog = renderDialog();

    expect(within(dialog).getByText(/Permanently erase books, covers/)).toBeInTheDocument();
    expect(within(dialog).getByText(/separately saved backups are kept/)).toBeInTheDocument();
});
it('keeps the reset disabled until the password is entered and the warning confirmed', async () => {
    signedInAdministrator();
    const dialog = renderDialog();

    await userEvent.type(within(dialog).getByLabelText(/^Current Admin password/), 'secret');

    expect(within(dialog).getByRole('button', { name: 'Reset data and sign out' })).toBeDisabled();
});
it('sends the current password and reports the reset', async () => {
    const api = signedInAdministrator().on('POST /maintenance/data-reset', () => ({
        status: 204,
    }));
    const onReset = vi.fn();
    const dialog = renderDialog(onReset);

    await confirmed(dialog, 'admin-password');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset data and sign out' }));

    expect(onReset).toHaveBeenCalledOnce();
    expect(api.calls).toContainEqual({
        route: 'POST /maintenance/data-reset',
        body: { password: 'admin-password' },
    });
});
it('shows a wrong password in the dialog without resetting', async () => {
    signedInAdministrator().on('POST /maintenance/data-reset', () => ({
        status: 400,
        body: { code: 'invalid_input', reason: 'password-incorrect', message: 'Incorrect' },
    }));
    const onReset = vi.fn();
    const dialog = renderDialog(onReset);

    await confirmed(dialog, 'wrong-password');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset data and sign out' }));

    expect(
        await within(dialog).findByText('Your current password is incorrect.'),
    ).toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();
});
it('closes on Cancel', async () => {
    signedInAdministrator();
    const onClose = vi.fn();
    const dialog = renderDialog(vi.fn(), onClose);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
});
