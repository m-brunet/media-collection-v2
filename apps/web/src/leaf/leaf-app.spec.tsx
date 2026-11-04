import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { account, deviceLanguages, FakeApi } from '../testing/fake-api.test-support';
import { LeafApp } from './leaf-app';

beforeEach(() => {
    window.history.replaceState(null, '', '/leaf/');
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('shows the Leaf name and sign-in to a signed-out visitor', async () => {
    new FakeApi();

    render(<LeafApp />);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Leaf')).toBeInTheDocument();
    expect(screen.getByText('by Media Collection')).toBeInTheDocument();
});

it('sends a temporary-password account to Libris first', async () => {
    new FakeApi().signedIn(account({ mustChangePassword: true }));

    render(<LeafApp />);

    expect(
        await screen.findByRole('heading', { name: 'Replace your temporary password' }),
    ).toBeInTheDocument();
});

it('shows the mobile home in the account language', async () => {
    new FakeApi().signedIn(account({ language: 'fr' }));

    render(<LeafApp />);

    expect(
        await screen.findByRole('heading', {
            name: 'Vos collections, où que vous fassiez vos achats.',
        }),
    ).toBeInTheDocument();
});

it('refuses the mobile interface to a Guest', async () => {
    new FakeApi().signedIn(account({ role: 'guest' }));

    render(<LeafApp />);

    expect(
        await screen.findByRole('heading', { name: 'Owner or Admin required' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Your collections, wherever you shop.')).not.toBeInTheDocument();
});

it('asks to finish first-launch setup on the host computer', async () => {
    new FakeApi().firstLaunch(false);

    render(<LeafApp />);

    expect(
        await screen.findByRole('heading', { name: 'Setup is not finished yet' }),
    ).toBeInTheDocument();
});
