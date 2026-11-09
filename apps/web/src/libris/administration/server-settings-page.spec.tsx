import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
    InternetAccessStatus,
    ServerStatus,
} from '../../../../../packages/contracts/src/http';
import { AppearanceProvider } from '../../shared/appearance/appearance-context';
import { SessionProvider } from '../../shared/session/session-context';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { ServerSettingsPage } from './server-settings-page';

const publicAddress = '82.66.118.204';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function internetAccess(overrides: Partial<InternetAccessStatus> = {}): InternetAccessStatus {
    return {
        phase: 'off',
        step: null,
        mapping: null,
        publicAddress: null,
        certificate: null,
        failure: null,
        failedAttempts: 0,
        nextAttemptAt: null,
        origin: null,
        manualRule: null,
        ...overrides,
    };
}

function status(access = internetAccess(), keepAwake = false): ServerStatus {
    return {
        configured: {
            http: { port: 34345 },
            tls: { enabled: access.phase === 'active', port: 3443, hasCertificate: false },
        },
        internetAccess: access,
        keepAwake,
        running: {
            httpPort: 34345,
            httpsPort: null,
            httpsError: null,
            addresses: ['http://127.0.0.1:34345'],
            httpPortOverride: null,
        },
        restartRequired: false,
    };
}

const active = internetAccess({
    phase: 'active',
    mapping: 'upnp',
    publicAddress,
    certificate: {
        address: publicAddress,
        issuedAt: '2026-11-08T10:00:00.000Z',
        expiresAt: '2026-11-15T02:00:00.000Z',
    },
    origin: 'https://' + publicAddress,
});
const waiting = internetAccess({
    phase: 'waiting-for-port',
    mapping: 'manual',
    publicAddress,
    failure: { reason: 'port-refused', at: '2026-11-08T10:00:00.000Z' },
    manualRule: {
        localAddress: '192.168.1.99',
        internalPort: 3443,
        externalPort: 443,
        protocol: 'TCP',
    },
});
// The addresses of a computer on a home network that also runs Tailscale.
const addresses = [
    'http://127.0.0.1:34345',
    'http://100.95.86.107:34345',
    'http://192.168.1.99:34345',
];

function withAddresses(current: ServerStatus): ServerStatus {
    return { ...current, running: { ...current.running, addresses } };
}

function administrator(current: ServerStatus) {
    return new FakeApi()
        .signedIn(account({ role: 'admin' }))
        .on('GET /server-settings', () => ({ status: 200, body: current }));
}

function renderPage() {
    render(
        <AppearanceProvider>
            <SessionProvider>
                <ServerSettingsPage />
            </SessionProvider>
        </AppearanceProvider>,
    );
}

it('offers to set up internet access with the Let’s Encrypt agreement', async () => {
    administrator(status());

    renderPage();

    expect(
        await screen.findByRole('button', { name: 'Set up internet access' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the agreement' })).toHaveAttribute(
        'href',
        'https://letsencrypt.org/repository/',
    );
});
it('starts the setup', async () => {
    const api = administrator(status()).on('POST /server-settings/internet-access', () => ({
        status: 202,
        body: internetAccess({ phase: 'setting-up', step: 'router' }),
    }));

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Set up internet access' }));

    expect(api.calls).toContainEqual({ route: 'POST /server-settings/internet-access', body: {} });
});
it('shows which setup step is running', async () => {
    administrator(status(internetAccess({ phase: 'setting-up', step: 'port' })));

    renderPage();

    const steps = await screen.findAllByRole('listitem');
    const running = steps.find((step) => step.getAttribute('aria-current') === 'step');

    expect(running).toHaveTextContent('Opening the port');
    expect(
        steps.find((step) => step.textContent?.includes('Finding your router')),
    ).toHaveTextContent('Done');
});
it('gives the Leaf address and its QR code once active', async () => {
    administrator(status(active));

    renderPage();

    expect(
        await screen.findByRole('link', { name: 'https://' + publicAddress + '/leaf/' }),
    ).toBeInTheDocument();
    expect(
        await screen.findByRole('img', { name: 'QR code for https://' + publicAddress + '/leaf/' }),
    ).toBeInTheDocument();
});
it('gives the router rule to add by hand', async () => {
    administrator(status(waiting));

    renderPage();

    expect(await screen.findByText('Add the rule in your router')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.99')).toBeInTheDocument();
    expect(screen.getByText(/refused to open port 443/)).toBeInTheDocument();
});
it('checks the rule again', async () => {
    const api = administrator(status(waiting)).on(
        'POST /server-settings/internet-access/check',
        () => ({
            status: 202,
            body: internetAccess({ phase: 'setting-up', step: 'certificate' }),
        }),
    );

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Check again' }));

    expect(api.calls.map((call) => call.route)).toContain(
        'POST /server-settings/internet-access/check',
    );
});
it('explains a provider sharing the address', async () => {
    administrator(
        status(internetAccess({ failure: { reason: 'cgnat', at: '2026-11-08T10:00:00.000Z' } })),
    );

    renderPage();

    expect(await screen.findByText(/shares your public address/)).toBeInTheDocument();
});
it('asks before replacing a saved certificate', async () => {
    const api = administrator(status()).on('POST /server-settings/internet-access', (body) =>
        (body as { replaceCertificate?: boolean }).replaceCertificate
            ? { status: 202, body: internetAccess({ phase: 'setting-up', step: 'router' }) }
            : {
                  status: 409,
                  body: {
                      code: 'conflict',
                      reason: 'certificate-replacement-unconfirmed',
                      message: 'Confirm',
                  },
              },
    );

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Set up internet access' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace the saved certificate?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace and set up' }));

    expect(api.calls).toContainEqual({
        route: 'POST /server-settings/internet-access',
        body: { replaceCertificate: true },
    });
});
it('asks before turning internet access off', async () => {
    const api = administrator(status(active)).on('DELETE /server-settings/internet-access', () => ({
        status: 200,
        body: internetAccess(),
    }));

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Turn off internet access' }));
    const dialog = await screen.findByRole('dialog', { name: 'Turn off internet access?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn off internet access' }));

    expect(api.calls.map((call) => call.route)).toContain(
        'DELETE /server-settings/internet-access',
    );
});
it('keeps the computer awake when asked', async () => {
    const api = administrator(status()).on('PUT /server-settings/keep-awake', () => ({
        status: 200,
        body: { enabled: true },
    }));

    renderPage();
    await userEvent.click(
        await screen.findByRole('checkbox', {
            name: 'Keep this computer awake while Media Collection runs',
        }),
    );

    expect(api.calls).toContainEqual({
        route: 'PUT /server-settings/keep-awake',
        body: { enabled: true },
    });
});
it('locks the manual HTTPS settings while internet access is on', async () => {
    administrator(status(active));

    renderPage();

    expect(
        await screen.findByRole('button', { name: 'Save HTTPS settings', hidden: true }),
    ).toBeDisabled();
});
it('shows no QR code until an address is chosen', async () => {
    administrator(withAddresses(status()));

    renderPage();
    await screen.findByRole('link', { name: 'http://192.168.1.99:34345' });

    expect(screen.queryByRole('img', { name: /^QR code for/ })).not.toBeInTheDocument();
});
it('shows the QR code opening Leaf at the chosen address', async () => {
    administrator(withAddresses(status()));

    renderPage();
    await userEvent.click(
        await screen.findByRole('button', {
            name: 'Show the QR code for http://192.168.1.99:34345',
        }),
    );

    expect(
        await screen.findByRole('img', { name: 'QR code for http://192.168.1.99:34345/leaf/' }),
    ).toBeInTheDocument();
});
it('keeps the address links on Libris', async () => {
    administrator(withAddresses(status()));

    renderPage();

    expect(await screen.findByRole('link', { name: 'http://192.168.1.99:34345' })).toHaveAttribute(
        'href',
        'http://192.168.1.99:34345',
    );
});
it('switches the QR code to another address', async () => {
    administrator(withAddresses(status()));
    renderPage();
    await userEvent.click(
        await screen.findByRole('button', {
            name: 'Show the QR code for http://192.168.1.99:34345',
        }),
    );

    await userEvent.click(
        screen.getByRole('button', { name: 'Show the QR code for http://100.95.86.107:34345' }),
    );

    expect(
        await screen.findByRole('img', { name: 'QR code for http://100.95.86.107:34345/leaf/' }),
    ).toBeInTheDocument();
});
it('marks only the chosen address as pressed', async () => {
    administrator(withAddresses(status()));
    renderPage();
    const tailscale = await screen.findByRole('button', {
        name: 'Show the QR code for http://100.95.86.107:34345',
    });

    await userEvent.click(tailscale);

    expect(
        screen
            .getAllByRole('button', { name: /^Show the QR code for/ })
            .map((button) => button.getAttribute('aria-pressed')),
    ).toEqual(['true', 'false']);
});
it('offers no QR code for the loopback address', async () => {
    administrator(withAddresses(status()));

    renderPage();
    await screen.findByRole('link', { name: 'http://127.0.0.1:34345' });

    expect(
        screen.queryByRole('button', { name: 'Show the QR code for http://127.0.0.1:34345' }),
    ).not.toBeInTheDocument();
});
it('puts the Libris mark in the centre of the QR code', async () => {
    administrator(withAddresses(status()));
    renderPage();

    await userEvent.click(
        await screen.findByRole('button', {
            name: 'Show the QR code for http://192.168.1.99:34345',
        }),
    );

    const code = await screen.findByRole('img', {
        name: 'QR code for http://192.168.1.99:34345/leaf/',
    });

    expect(code.querySelector('.qr-code__mark img')).toHaveAttribute('src', '/libris.svg');
});
