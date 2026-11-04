import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AccountSummary } from '../../../../../packages/contracts/src/http';
import { SessionProvider } from '../../shared/session/session-context';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { AccountsPage } from './accounts-page';

const administrator: AccountSummary = {
    id: 'admin',
    username: 'alex',
    role: 'admin',
    mustChangePassword: false,
    active: true,
};
const owner: AccountSummary = {
    id: 'camille',
    username: 'camille',
    role: 'owner',
    mustChangePassword: false,
    active: true,
};
const former: AccountSummary = {
    id: 'robin',
    username: 'robin',
    role: 'owner',
    mustChangePassword: false,
    active: false,
};

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function signedInAdministrator() {
    return new FakeApi()
        .signedIn(account({ id: 'admin', username: 'alex', role: 'admin' }))
        .on('GET /users', () => ({ status: 200, body: [administrator, owner, former] }));
}

function renderPage() {
    render(
        <SessionProvider>
            <AccountsPage />
        </SessionProvider>,
    );
}

it('presents the protected administrator separately from the other accounts', async () => {
    signedInAdministrator();

    renderPage();

    expect(await screen.findByText('Protected administrator')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Deactivate · alex/ })).not.toBeInTheDocument();
});

it('shows each account role and status', async () => {
    signedInAdministrator();

    renderPage();

    const row = (await screen.findByText('robin')).closest('tr')!;

    expect(within(row).getByText('Owner')).toBeInTheDocument();
    expect(within(row).getByText('Deactivated')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Reactivate · robin' })).toBeInTheDocument();
});

it('creates an account with an explicitly chosen role', async () => {
    const api = signedInAdministrator().on('POST /users', () => ({
        status: 201,
        body: { id: 'sam', username: 'sam', role: 'guest', mustChangePassword: true, active: true },
    }));

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Create account' }));
    const dialog = screen.getByRole('dialog', { name: 'Create account' });

    await userEvent.type(within(dialog).getByLabelText(/^Username/), 'sam');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Role/), 'guest');
    await userEvent.type(
        within(dialog).getByLabelText(/^Temporary password/),
        'temporary-password',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('sam')).toBeInTheDocument();
    expect(api.calls).toContainEqual({
        route: 'POST /users',
        body: { username: 'sam', password: 'temporary-password', role: 'guest' },
    });
});

it('offers no role by default when creating an account', async () => {
    signedInAdministrator();

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Create account' }));

    const role = within(screen.getByRole('dialog')).getByLabelText(/^Role/);

    expect(role).toHaveValue('');
    expect(within(role).queryByRole('option', { name: 'Administrator' })).not.toBeInTheDocument();
});

it('deactivates an account after confirmation', async () => {
    const api = signedInAdministrator().on('POST /users/camille/deactivation', () => ({
        status: 200,
        body: { ...owner, active: false },
    }));

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate · camille' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate camille?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Account camille deactivated.')).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).toContain('POST /users/camille/deactivation');
});

it('changes nothing when deactivation is cancelled', async () => {
    const api = signedInAdministrator();

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate · camille' }));

    await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );

    expect(api.calls.map((call) => call.route)).not.toContain('POST /users/camille/deactivation');
});

it('resets a password to a temporary one', async () => {
    signedInAdministrator().on('POST /users/camille/password-reset', () => ({
        status: 200,
        body: { ...owner, mustChangePassword: true },
    }));

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Reset password · camille' }));
    const dialog = screen.getByRole('dialog', { name: 'Reset password for camille' });

    await userEvent.type(within(dialog).getByLabelText(/^Temporary password/), 'new-temporary');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset password' }));

    expect(
        await screen.findByText('Temporary password set for camille. Share it with them.'),
    ).toBeInTheDocument();
});

it('explains a refused change with its translated reason', async () => {
    signedInAdministrator().on('POST /users/camille/deactivation', () => ({
        status: 409,
        body: { code: 'conflict', reason: 'already-inactive', message: 'Already' },
    }));

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate · camille' }));

    await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
        'This account is already deactivated.',
    );
});
