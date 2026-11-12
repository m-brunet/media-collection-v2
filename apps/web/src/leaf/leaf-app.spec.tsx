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

it('offers Collections and Scan on the mobile home', async () => {
    new FakeApi().signedIn(account());

    render(<LeafApp />);

    expect(await screen.findByRole('link', { name: /Collections/ })).toHaveAttribute(
        'href',
        '/leaf/collections',
    );
    expect(screen.getByRole('link', { name: /Scan a book/ })).toHaveAttribute('href', '/leaf/scan');
});

it('shows the signed-in account and its role with Sign out', async () => {
    new FakeApi().signedIn(account({ username: 'alex', role: 'admin' }));

    render(<LeafApp />);

    expect(await screen.findByText('alex · Administrator')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
});

it('refuses a Guest who opens a shopping link directly', async () => {
    window.history.replaceState(null, '', '/leaf/collections');
    const api = new FakeApi().signedIn(account({ role: 'guest' }));

    render(<LeafApp />);

    expect(
        await screen.findByRole('heading', { name: 'Owner or Admin required' }),
    ).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).not.toContain('GET /collections/shopping');
});

it('signs the phone in with the code of the QR code', async () => {
    new FakeApi().on('POST /auth/pair', () => ({
        status: 200,
        body: account({ username: 'administrator', role: 'admin' }),
    }));

    render(<LeafApp pairing={'A'.repeat(43)} />);

    expect(await screen.findByText('administrator · Administrator')).toBeInTheDocument();
});

it('sends the code of the QR code once', async () => {
    const api = new FakeApi().on('POST /auth/pair', () => ({
        status: 200,
        body: account({ role: 'admin' }),
    }));

    render(<LeafApp pairing={'A'.repeat(43)} />);
    await screen.findByRole('link', { name: /Collections/ });

    expect(api.calls.filter((call) => call.route === 'POST /auth/pair')).toEqual([
        { route: 'POST /auth/pair', body: { code: 'A'.repeat(43) } },
    ]);
});

it('explains an expired QR code on the sign-in screen', async () => {
    new FakeApi().on('POST /auth/pair', () => ({
        status: 401,
        body: {
            message: 'This QR code has expired. Show it again on the computer.',
            reason: 'pairing-code-expired',
        },
    }));

    render(<LeafApp pairing={'A'.repeat(43)} />);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(
        screen.getByText('This QR code has expired. Show it again on the computer.'),
    ).toBeInTheDocument();
});

it('keeps an existing session when the QR code has expired', async () => {
    new FakeApi()
        .signedIn(account())
        .on('POST /auth/pair', () => ({ status: 401, body: { message: 'Expired' } }));

    render(<LeafApp pairing={'A'.repeat(43)} />);

    expect(await screen.findByRole('link', { name: /Collections/ })).toBeInTheDocument();
});
