import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
    HttpInternetAccessStatus,
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
        domain: null,
        certificate: null,
        failure: null,
        failedAttempts: 0,
        nextAttemptAt: null,
        origin: null,
        manualRule: null,
        ...overrides,
    };
}

function httpAccess(overrides: Partial<HttpInternetAccessStatus> = {}): HttpInternetAccessStatus {
    return {
        phase: 'off',
        mapping: null,
        publicAddress: null,
        failure: null,
        closedByHttps: false,
        origin: null,
        manualRule: null,
        ...overrides,
    };
}

const httpOpen = httpAccess({
    phase: 'open',
    mapping: 'upnp',
    publicAddress,
    origin: 'http://' + publicAddress + ':34345',
});

function status(
    access = internetAccess(),
    keepAwake = false,
    extra: Partial<ServerStatus> = {},
): ServerStatus {
    return {
        domainName: null,
        httpInternetAccess: httpAccess(),
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
        ...extra,
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

// A button of the domain name form (other forms have their own Save buttons).
async function domainButton(name: string) {
    return within(await screen.findByRole('form', { name: 'Domain name (optional)' })).getByRole(
        'button',
        { name },
    );
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
it('saves the domain name', async () => {
    const api = administrator(status()).on('PUT /server-settings/domain-name', () => ({
        status: 200,
        body: { domain: 'home.example.fr' },
    }));

    renderPage();
    await userEvent.type(
        await screen.findByRole('textbox', { name: 'Domain name (optional)' }),
        ' home.example.fr ',
    );
    await userEvent.click(await domainButton('Save'));

    expect(await screen.findByText(/Domain name saved/)).toBeInTheDocument();
    expect(api.calls).toContainEqual({
        route: 'PUT /server-settings/domain-name',
        body: { domain: 'home.example.fr' },
    });
});
it('offers no saving while the field holds the saved domain name', async () => {
    administrator(status(undefined, false, { domainName: 'home.example.fr' }));

    renderPage();

    expect(await domainButton('Save')).toBeDisabled();
});
it('offers saving once the domain name changes', async () => {
    administrator(status(undefined, false, { domainName: 'home.example.fr' }));

    renderPage();
    const field = await screen.findByRole('textbox', { name: 'Domain name (optional)' });

    await userEvent.type(field, 'x');

    expect(await domainButton('Save')).toBeEnabled();
});
it('offers no saving while the field is empty', async () => {
    administrator(status());

    renderPage();

    expect(await domainButton('Save')).toBeDisabled();
});
it('removes the domain name with its own button', async () => {
    const api = administrator(status(undefined, false, { domainName: 'home.example.fr' })).on(
        'PUT /server-settings/domain-name',
        () => ({ status: 200, body: { domain: null } }),
    );

    renderPage();
    await userEvent.click(await domainButton('Remove'));

    expect(await screen.findByText(/Domain name removed/)).toBeInTheDocument();
    expect(api.calls).toContainEqual({
        route: 'PUT /server-settings/domain-name',
        body: { domain: null },
    });
});
it('offers no removal of the domain name while HTTPS is on', async () => {
    administrator(status(active, false, { domainName: 'home.example.fr' }));

    renderPage();

    expect(await domainButton('Remove')).toBeDisabled();
    expect(
        screen.getByText('To remove the domain name, turn off HTTPS from the internet first.'),
    ).toBeInTheDocument();
});
it('offers no removal without a saved domain name', async () => {
    administrator(status());

    renderPage();

    expect(await domainButton('Remove')).toBeDisabled();
});
it('offers removal of a saved domain name while HTTPS is off', async () => {
    administrator(status(undefined, false, { domainName: 'home.example.fr' }));

    renderPage();

    expect(await domainButton('Remove')).toBeEnabled();
});
it('shows the saved domain name', async () => {
    administrator(status(undefined, false, { domainName: 'home.example.fr' }));

    renderPage();

    expect(await screen.findByRole('textbox', { name: 'Domain name (optional)' })).toHaveValue(
        'home.example.fr',
    );
});
it('explains a refused domain name with the address of the connection', async () => {
    administrator(status()).on('PUT /server-settings/domain-name', () => ({
        status: 400,
        body: {
            code: 'invalid_input',
            reason: 'domain-mismatch',
            message: 'The domain name does not point to this connection.',
            details: { publicAddress },
        },
    }));

    renderPage();
    await userEvent.type(
        await screen.findByRole('textbox', { name: 'Domain name (optional)' }),
        'home.example.fr',
    );
    await userEvent.click(await domainButton('Save'));

    expect(
        await screen.findByText(/does not point to this connection’s address \(82\.66\.118\.204\)/),
    ).toBeInTheDocument();
});
it('explains an invalid domain name', async () => {
    administrator(status()).on('PUT /server-settings/domain-name', () => ({
        status: 400,
        body: { code: 'invalid_input', reason: 'domain-name-invalid', message: 'Invalid' },
    }));

    renderPage();
    await userEvent.type(
        await screen.findByRole('textbox', { name: 'Domain name (optional)' }),
        'https://home.example.fr',
    );
    await userEvent.click(await domainButton('Save'));

    expect(await screen.findByText(/without https:\/\/ or a port/)).toBeInTheDocument();
});
it('explains an HTTPS setup stopped by a domain name that points elsewhere', async () => {
    administrator(
        status(
            internetAccess({
                domain: 'home.example.fr',
                publicAddress,
                failure: { reason: 'domain-mismatch', at: '2026-11-08T10:00:00.000Z' },
            }),
        ),
    );

    renderPage();

    expect(
        await screen.findByText(
            /home\.example\.fr does not point to this connection’s address \(82\.66\.118\.204\)/,
        ),
    ).toBeInTheDocument();
});
it('lists the HTTPS address on the domain name once active', async () => {
    administrator(
        status({ ...active, domain: 'home.example.fr', origin: 'https://home.example.fr' }),
    );

    renderPage();

    expect(
        await screen.findByRole('link', { name: 'https://home.example.fr' }),
    ).toBeInTheDocument();
});
it('warns before opening HTTP to the internet', async () => {
    administrator(status());

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Open HTTP to the internet' }));

    const dialog = await screen.findByRole('dialog', { name: 'Open HTTP to the internet?' });

    expect(within(dialog).getByText(/HTTP is not encrypted/)).toBeInTheDocument();
});
it('opens HTTP to the internet once the warning is confirmed', async () => {
    const api = administrator(status()).on('POST /server-settings/internet-access/http', () => ({
        status: 201,
        body: httpOpen,
    }));

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Open HTTP to the internet' }));
    const dialog = await screen.findByRole('dialog', { name: 'Open HTTP to the internet?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Open without encryption' }));

    expect(api.calls.map((call) => call.route)).toContain(
        'POST /server-settings/internet-access/http',
    );
});
it('lists the HTTP address while HTTP is open', async () => {
    administrator(status(undefined, false, { httpInternetAccess: httpOpen }));

    renderPage();

    expect(
        await screen.findByRole('link', { name: 'http://' + publicAddress + ':34345' }),
    ).toBeInTheDocument();
});
it('closes HTTP to the internet', async () => {
    const api = administrator(status(undefined, false, { httpInternetAccess: httpOpen })).on(
        'DELETE /server-settings/internet-access/http',
        () => ({ status: 200, body: httpAccess() }),
    );

    renderPage();
    const close = await screen.findByRole('button', { name: 'Close HTTP' });

    await userEvent.click(close);

    expect(api.calls.map((call) => call.route)).toContain(
        'DELETE /server-settings/internet-access/http',
    );
});
it('offers no HTTP while HTTPS works', async () => {
    administrator(status(active));

    renderPage();

    expect(await screen.findByText('HTTPS works, so HTTP stays closed.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open HTTP to the internet' })).toBeNull();
});
it('says that a working HTTPS closed HTTP', async () => {
    administrator(
        status(active, false, { httpInternetAccess: httpAccess({ closedByHttps: true }) }),
    );

    renderPage();

    expect(
        await screen.findByText(
            'HTTP was closed because HTTPS works. Phones use the HTTPS address.',
        ),
    ).toBeInTheDocument();
});
it('lists the internet addresses with the local ones', async () => {
    administrator(status(active, false, { httpInternetAccess: httpOpen }));

    renderPage();
    await screen.findByRole('link', { name: 'http://127.0.0.1:34345' });

    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));

    expect(links).toEqual(
        expect.arrayContaining([
            'http://127.0.0.1:34345',
            'http://' + publicAddress + ':34345',
            'https://' + publicAddress,
        ]),
    );
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
it('lists the HTTPS address with its QR code button once active', async () => {
    administrator(status(active));

    renderPage();

    expect(
        await screen.findByRole('link', { name: 'https://' + publicAddress }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /^QR code for/ })).not.toBeInTheDocument();
    expect(
        screen.getByRole('button', { name: 'Show the QR code for https://' + publicAddress }),
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
