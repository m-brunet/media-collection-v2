import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '../../shared/session/session-context';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { PasswordForm } from './password-form';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

async function fill(current: string, next: string, confirmation: string) {
    await userEvent.type(screen.getByLabelText(/Current password/), current);
    await userEvent.type(screen.getByLabelText(/^New password/), next);
    await userEvent.type(screen.getByLabelText(/Confirm new password/), confirmation);
}

it('refuses different new passwords without contacting the server', async () => {
    const api = new FakeApi().signedIn(account());

    render(
        <SessionProvider>
            <PasswordForm />
        </SessionProvider>,
    );
    await fill('old-password', 'new-password-1', 'new-password-2');

    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The new passwords do not match.');
    expect(api.calls.some((call) => call.route === 'PATCH /account/password')).toBe(false);
});

it('confirms a changed password', async () => {
    new FakeApi()
        .signedIn(account())
        .on('PATCH /account/password', () => ({ status: 200, body: account() }));

    render(
        <SessionProvider>
            <PasswordForm />
        </SessionProvider>,
    );
    await fill('old-password', 'new-password-1', 'new-password-1');

    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Password changed.');
});

it('explains an incorrect current password', async () => {
    new FakeApi()
        .signedIn(account())
        .on('PATCH /account/password', () => ({ status: 400, body: { code: 'invalid_input' } }));

    render(
        <SessionProvider>
            <PasswordForm />
        </SessionProvider>,
    );
    await fill('wrong-password', 'new-password-1', 'new-password-1');

    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
        'Your current password is incorrect.',
    );
});
