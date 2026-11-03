import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { account, deviceLanguages, FakeApi } from '../testing/fake-api.test-support';
import { LibrisApp } from './libris-app';

beforeEach(() => {
    window.history.replaceState(null, '', '/');
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('asks a signed-out visitor to sign in', async () => {
    new FakeApi();

    render(<LibrisApp />);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('by Media Collection')).toBeInTheDocument();
});

it('does not report an ended session on a first visit', async () => {
    new FakeApi();

    render(<LibrisApp />);

    await screen.findByRole('heading', { name: 'Sign in' });
    expect(screen.queryByText('Your session ended. Sign in again.')).not.toBeInTheDocument();
});

it('shows the sign-in page in French on a French device', async () => {
    deviceLanguages(['fr-FR']);
    new FakeApi();

    render(<LibrisApp />);

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fr');
});

it('switches the sign-in page to French and remembers the choice on this device', async () => {
    new FakeApi();
    render(<LibrisApp />);
    await screen.findByRole('heading', { name: 'Sign in' });

    await userEvent.click(screen.getByRole('button', { name: 'Français' }));

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(window.localStorage.getItem('media-collection.language')).toBe('fr');
});

it('explains an incorrect sign-in', async () => {
    new FakeApi().on('POST /auth/login', () => ({ status: 401, body: { message: 'No' } }));
    render(<LibrisApp />);
    await userEvent.type(await screen.findByLabelText(/Username/), 'alex');
    await userEvent.type(screen.getByLabelText(/^Password/), 'wrong-password');

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.');
});

it('requires a temporary password to be replaced before showing the library', async () => {
    new FakeApi().signedIn(account({ mustChangePassword: true }));

    render(<LibrisApp />);

    expect(
        await screen.findByRole('heading', { name: 'Choose your own password' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

it('applies the language saved on the account after sign-in', async () => {
    new FakeApi().signedIn(account({ language: 'fr' }));

    render(<LibrisApp />);

    expect(await screen.findByRole('heading', { name: 'Mon compte' })).toBeInTheDocument();
});

it('shows administration only to an administrator', async () => {
    new FakeApi().signedIn(account({ role: 'admin' })).on('GET /users', () => ({
        status: 200,
        body: [],
    }));

    render(<LibrisApp />);

    expect(await screen.findByRole('link', { name: 'Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Server settings' })).toBeInTheDocument();
});

it('hides administration from other accounts', async () => {
    new FakeApi().signedIn(account());

    render(<LibrisApp />);

    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Accounts' })).not.toBeInTheDocument();
});

it('redirects a non-administrator away from administration pages', async () => {
    window.history.replaceState(null, '', '/admin/server');
    new FakeApi().signedIn(account());

    render(<LibrisApp />);

    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/account');
});

it('saves a language change to the signed-in account', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('PATCH /account/language', () => ({ status: 200, body: account({ language: 'fr' }) }));

    render(<LibrisApp />);
    await screen.findByRole('heading', { name: 'My account' });

    await userEvent.click(screen.getAllByRole('button', { name: 'Français' })[0]!);

    expect(await screen.findByRole('heading', { name: 'Mon compte' })).toBeInTheDocument();
    expect(api.calls).toContainEqual({
        route: 'PATCH /account/language',
        body: { language: 'fr' },
    });
});

it('reports a page that does not exist', async () => {
    window.history.replaceState(null, '', '/missing');
    new FakeApi().signedIn(account());

    render(<LibrisApp />);

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
});
