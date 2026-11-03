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
