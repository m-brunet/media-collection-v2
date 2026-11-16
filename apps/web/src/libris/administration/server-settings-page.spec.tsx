import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QRCode from 'qrcode';
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
        retryAfter: null,
        awaitingCheck: false,
        routerPort: null,
        addressMoved: false,
        renewalAt: null,
        allowances: null,
        origin: null,
        manualRule: null,
        checkRule: null,
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
    routerPort: 3443,
    renewalAt: '2026-11-11T18:00:00.000Z',
    certificate: {
        address: publicAddress,
        issuedAt: '2026-11-08T10:00:00.000Z',
        expiresAt: '2026-11-15T02:00:00.000Z',
    },
    origin: 'https://' + publicAddress + ':3443',
});
const rulesByHand = {
    manualRule: {
        localAddress: '192.168.1.99',
        internalPort: 3443,
        externalPort: 3443,
        protocol: 'TCP' as const,
    },
    checkRule: {
        localAddress: '192.168.1.99',
        internalPort: 3443,
        externalPort: 443,
        protocol: 'TCP' as const,
    },
};
const waiting = internetAccess({
    phase: 'waiting-for-port',
    mapping: 'manual',
    publicAddress,
    routerPort: 3443,
    failure: { reason: 'port-refused', at: '2026-11-08T10:00:00.000Z' },
    ...rulesByHand,
});
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
            'https://' + publicAddress + ':3443',
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
        await screen.findByRole('link', { name: 'https://' + publicAddress + ':3443' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /^QR code for/ })).not.toBeInTheDocument();
    expect(
        screen.getByRole('button', {
            name: 'Show the QR code for https://' + publicAddress + ':3443',
        }),
    ).toBeInTheDocument();
});
it('gives the router rule to add by hand', async () => {
    administrator(status(waiting));

    renderPage();

    expect(await screen.findByText('Add the rule in your router')).toBeInTheDocument();
    expect(screen.getAllByText('192.168.1.99')).toHaveLength(2);
    expect(screen.getByText(/refused to open port 3443/)).toBeInTheDocument();
});
it('gives the port 443 rule needed only while Let’s Encrypt checks', async () => {
    administrator(status({ ...waiting, domain: 'home.example.fr' }));

    renderPage();

    expect(
        await screen.findByText('Port 443, only while Let’s Encrypt checks'),
    ).toBeInTheDocument();
    expect(screen.getByText('443', { exact: true })).toBeInTheDocument();
});
it('reminds to open port 443 before the renewal of a domain name certificate', async () => {
    administrator(
        status({
            ...active,
            mapping: 'manual',
            domain: 'home.example.fr',
            origin: 'https://home.example.fr:3443',
            ...rulesByHand,
        }),
    );

    renderPage();

    expect(
        await screen.findByText(/^Open port 443 on your router before .*You may close it/),
    ).toBeInTheDocument();
});
it('advises a permanent port 443 rule for an address without a domain name', async () => {
    administrator(status({ ...active, mapping: 'manual', ...rulesByHand }));

    renderPage();

    expect(await screen.findByText(/renewed every 3 days: keep port 443 open/)).toBeInTheDocument();
    expect(screen.queryByText(/^Open port 443 on your router before/)).not.toBeInTheDocument();
});
it('gives no rule to add by hand when the router opened it', async () => {
    administrator(status(active));

    renderPage();

    await screen.findByText('Internet access is on.');

    expect(screen.queryByText('Add the rule in your router')).not.toBeInTheDocument();
});
it('tells once that phones need the new address', async () => {
    administrator(status({ ...active, addressMoved: true }));

    renderPage();

    expect(
        await screen.findByText(
            'The internet address is now https://' +
                publicAddress +
                ':3443. Scan the QR code again on each phone.',
        ),
    ).toBeInTheDocument();
});
it('hides the new address notice once closed', async () => {
    const api = administrator(status({ ...active, addressMoved: true })).on(
        'DELETE /server-settings/internet-access/address-notice',
        () => ({ status: 200, body: active }),
    );

    renderPage();
    await screen.findByText(/Scan the QR code again/);
    await userEvent.click(screen.getByRole('button', { name: 'Close message' }));

    expect(api.calls.map((call) => call.route)).toContain(
        'DELETE /server-settings/internet-access/address-notice',
    );
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
const awaitingCheck = internetAccess({
    ...active,
    failure: { reason: 'not-reachable', at: '2026-11-08T10:00:00.000Z' },
    awaitingCheck: true,
    allowances: {
        certificates: { left: 4, nextAt: null },
        checks: { left: 3, nextAt: null },
    },
});

it('waits for Check again after a failed check while internet access is on', async () => {
    administrator(status(awaitingCheck));

    renderPage();

    expect(
        await screen.findByText(/Nothing is tried again until you check again/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled();
});
it('checks again while internet access is on', async () => {
    const api = administrator(status(awaitingCheck)).on(
        'POST /server-settings/internet-access/check',
        () => ({ status: 202, body: { ...awaitingCheck, step: 'certificate' } }),
    );

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Check again' }));

    expect(api.calls.map((call) => call.route)).toContain(
        'POST /server-settings/internet-access/check',
    );
});
it('shows a check running while internet access is on, without the button', async () => {
    administrator(status({ ...awaitingCheck, step: 'certificate' }));

    renderPage();

    expect(await screen.findByText('Checking again…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull();
});
it('estimates what Let’s Encrypt still allows after a failure', async () => {
    administrator(status(awaitingCheck));

    renderPage();

    expect(
        await screen.findByText(
            'Certificates left this week for ' +
                publicAddress +
                ': about 4. Checks left this hour: about 3.',
        ),
    ).toBeInTheDocument();
    expect(screen.getByText(/This is an estimate/)).toBeInTheDocument();
});
it('says when an attempt is probably refused, keeping the button usable', async () => {
    administrator(
        status(
            internetAccess({
                failure: { reason: 'not-reachable', at: '2026-11-08T10:00:00.000Z' },
                publicAddress,
                allowances: {
                    certificates: { left: 4, nextAt: null },
                    checks: { left: 0, nextAt: '2026-11-08T10:12:00.000Z' },
                },
            }),
        ),
    );

    renderPage();

    expect(await screen.findByText(/Probably refused until/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up internet access' })).toBeEnabled();
});
it('waits for Let’s Encrypt’s date after a rate limit, with the button disabled', async () => {
    administrator(
        status(
            internetAccess({
                failure: { reason: 'rate-limited', at: '2026-11-08T10:00:00.000Z' },
                retryAfter: '2099-11-12T23:30:00.000Z',
            }),
        ),
    );

    renderPage();

    expect(
        await screen.findByText(/Let’s Encrypt accepts a new attempt after/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up internet access' })).toBeDisabled();
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
it('warns that setting up again uses a certificate', async () => {
    administrator(status(active));

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Turn off internet access' }));

    const dialog = await screen.findByRole('dialog', { name: 'Turn off internet access?' });

    expect(
        within(dialog).getByText(/uses one of the 5 certificates Let’s Encrypt allows per week/),
    ).toBeInTheDocument();
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
it('shows both ports outside the advanced settings', async () => {
    administrator(status());

    renderPage();

    const form = await screen.findByRole('form', { name: 'HTTPS / internet access' });

    expect([form.closest('details'), within(form).getByLabelText(/^HTTPS port/)]).toEqual([
        null,
        expect.objectContaining({ value: '3443' }),
    ]);
});
it('saves the HTTPS port', async () => {
    const api = administrator(status()).on('PUT /server-settings/https-port', () => ({
        status: 200,
        body: status(),
    }));

    renderPage();
    const form = await screen.findByRole('form', { name: 'HTTPS / internet access' });

    await userEvent.clear(within(form).getByLabelText(/^HTTPS port/));
    await userEvent.type(within(form).getByLabelText(/^HTTPS port/), '34443');
    await userEvent.click(within(form).getByRole('button', { name: 'Save HTTPS port' }));

    expect(api.calls).toContainEqual({
        route: 'PUT /server-settings/https-port',
        body: { port: 34443 },
    });
});
it('says a saved HTTPS port applies after a restart', async () => {
    administrator(status()).on('PUT /server-settings/https-port', () => ({
        status: 200,
        body: status(),
    }));

    renderPage();
    const form = await screen.findByRole('form', { name: 'HTTPS / internet access' });

    await userEvent.click(within(form).getByRole('button', { name: 'Save HTTPS port' }));

    expect(await screen.findByText(/^HTTPS port saved. Close and reopen/)).toBeInTheDocument();
});
it('saves the manual certificate without a port', async () => {
    const api = administrator(status()).on('PUT /server-settings', () => ({
        status: 200,
        body: status(),
    }));

    renderPage();
    await userEvent.click(
        await screen.findByRole('button', { name: 'Save HTTPS settings', hidden: true }),
    );

    expect(api.calls).toContainEqual({ route: 'PUT /server-settings', body: { enabled: false } });
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
it('tells that config.json sets the running HTTP port', async () => {
    const current = status();

    administrator({
        ...current,
        running: { ...current.running, httpPortOverride: { port: 4000, source: 'config-file' } },
    });

    renderPage();

    expect(
        await screen.findByText(
            'The httpPort setting of config.json is active on port 4000. Remove it from the file, then close and reopen the desktop application to use the saved port.',
        ),
    ).toBeInTheDocument();
});
it('tells that a command-line option sets the running HTTP port', async () => {
    const current = status();

    administrator({
        ...current,
        running: { ...current.running, httpPortOverride: { port: 4000, source: 'command-line' } },
    });

    renderPage();

    expect(
        await screen.findByText(
            'A command-line port override is active on port 4000. Remove it, then close and reopen the desktop application to use the saved port.',
        ),
    ).toBeInTheDocument();
});

const pairingCode = 'A'.repeat(43);

function pairable(current: ServerStatus, expiresIn = 120_000): FakeApi {
    return administrator(current).on('POST /auth/pairing-codes', (body) => ({
        status: 201,
        body: {
            link: (body as { address: string }).address + '/leaf/#pair=' + pairingCode,
            expiresAt: new Date(Date.now() + expiresIn).toISOString(),
        },
    }));
}

async function showQrCode(address: string): Promise<void> {
    await userEvent.click(
        await screen.findByRole('button', { name: 'Show the QR code for ' + address }),
    );
}

it('shows a QR code that signs a phone in at a home network address', async () => {
    const encode = vi.spyOn(QRCode, 'toString');

    pairable(withAddresses(status()));
    renderPage();

    await showQrCode('http://192.168.1.99:34345');

    expect(
        await screen.findByText(
            'This code signs a phone in as alex. It works once, for 2 minutes.',
        ),
    ).toBeInTheDocument();
    expect(encode).toHaveBeenLastCalledWith(
        'http://192.168.1.99:34345/leaf/#pair=' + pairingCode,
        expect.anything(),
    );
});
it('shows a QR code that signs a phone in at a Tailscale address', async () => {
    const encode = vi.spyOn(QRCode, 'toString');

    pairable(withAddresses(status()));
    renderPage();

    await showQrCode('http://100.95.86.107:34345');

    await screen.findByText(/This code signs a phone in as alex/);
    expect(encode).toHaveBeenLastCalledWith(
        'http://100.95.86.107:34345/leaf/#pair=' + pairingCode,
        expect.anything(),
    );
});
it('shows a QR code that signs a phone in at the HTTPS internet address', async () => {
    const encode = vi.spyOn(QRCode, 'toString');

    pairable(status(active));
    renderPage();

    await showQrCode('https://' + publicAddress + ':3443');

    await screen.findByText(/This code signs a phone in as alex/);
    expect(encode).toHaveBeenLastCalledWith(
        'https://' + publicAddress + ':3443/leaf/#pair=' + pairingCode,
        expect.anything(),
    );
});
it('keeps a plain QR code for the HTTP internet address', async () => {
    const encode = vi.spyOn(QRCode, 'toString');
    const api = pairable(status(undefined, false, { httpInternetAccess: httpOpen }));

    renderPage();

    await showQrCode('http://' + publicAddress + ':34345');

    expect(
        await screen.findByRole('img', {
            name: 'QR code for http://' + publicAddress + ':34345/leaf/',
        }),
    ).toBeInTheDocument();
    expect(encode).toHaveBeenLastCalledWith(
        'http://' + publicAddress + ':34345/leaf/',
        expect.anything(),
    );
    expect(screen.queryByText(/This code signs a phone in/)).not.toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).not.toContain('POST /auth/pairing-codes');
});
it('asks for a new code when the shown one expires', async () => {
    const api = pairable(withAddresses(status()), 50);

    renderPage();

    await showQrCode('http://192.168.1.99:34345');

    await waitFor(() =>
        expect(api.calls.filter((call) => call.route === 'POST /auth/pairing-codes')).toHaveLength(
            2,
        ),
    );
});

async function card(name: 'This computer' | 'Home network' | 'Internet') {
    return screen.findByRole('region', { name });
}

function row(title: string) {
    const heading = screen.getByRole('heading', { name: title, level: 3 });

    return heading.closest('.setting-row') as HTMLElement;
}

it('puts each address in the card of the place it reaches', async () => {
    administrator(withAddresses(status(active, false, { httpInternetAccess: httpOpen })));

    renderPage();

    expect(
        within(await card('This computer'))
            .getAllByRole('link')
            .map((link) => link.textContent),
    ).toEqual(['http://127.0.0.1:34345']);
    expect(
        within(await card('Home network'))
            .getAllByRole('link')
            .map((link) => link.textContent),
    ).toEqual(['http://100.95.86.107:34345', 'http://192.168.1.99:34345']);
    expect(
        within(await card('Internet'))
            .getAllByRole('link')
            .map((link) => link.textContent),
    ).toEqual(['https://' + publicAddress + ':3443', 'http://' + publicAddress + ':34345']);
});
it('gives each home address its own QR code button', async () => {
    administrator(withAddresses(status()));

    renderPage();

    expect(
        within(await card('Home network')).getAllByRole('button', {
            name: /^Show the QR code for/,
        }),
    ).toHaveLength(2);
});
it('keeps the card of a place without an address, marked Off', async () => {
    administrator(status());

    renderPage();
    const home = await card('Home network');

    expect(within(home).getByText('Off')).toBeInTheDocument();
    expect(within(home).getByText('No address')).toBeInTheDocument();
});
it('marks the computer reachable from its own browser', async () => {
    administrator(status());

    renderPage();

    expect(within(await card('This computer')).getByText('On')).toBeInTheDocument();
});
it('says internet access is not set up', async () => {
    administrator(status());

    renderPage();
    const internet = await card('Internet');

    expect(within(internet).getByText('Off')).toBeInTheDocument();
    expect(within(internet).getByText('Not set up')).toBeInTheDocument();
});
it('says internet access is being set up', async () => {
    administrator(status(internetAccess({ phase: 'setting-up', step: 'router' })));

    renderPage();
    const internet = await card('Internet');

    expect(within(internet).getByText('Setting up')).toBeInTheDocument();
    expect(within(internet).getByText('Not reachable yet')).toBeInTheDocument();
});
it('says internet access needs a rule in the router', async () => {
    administrator(status(waiting));

    renderPage();

    expect(within(await card('Internet')).getByText('Needs your help')).toBeInTheDocument();
});
it('says internet access works over HTTPS, with the certificate date', async () => {
    administrator(status(active));

    renderPage();
    const internet = await card('Internet');

    expect(within(internet).getByText('On · HTTPS')).toBeInTheDocument();
    expect(
        within(internet).getByText(/^From anywhere, encrypted. Certificate valid until/),
    ).toBeInTheDocument();
});
it('says the internet address is not encrypted while HTTP is open', async () => {
    administrator(status(undefined, false, { httpInternetAccess: httpOpen }));

    renderPage();

    expect(within(await card('Internet')).getByText('On · not encrypted')).toBeInTheDocument();
});
it('asks for no sign-in code before an address is chosen', async () => {
    const api = pairable(withAddresses(status()));

    renderPage();
    await card('Home network');

    expect(
        screen.getByText('Choose “Show QR code” on an address to connect a phone.'),
    ).toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).not.toContain('POST /auth/pairing-codes');
});
it('asks for a sign-in code for the chosen address and outlines its card', async () => {
    const api = pairable(withAddresses(status()));

    renderPage();

    await showQrCode('http://192.168.1.99:34345');

    await screen.findByText(/This code signs a phone in as alex/);
    expect(api.calls).toContainEqual({
        route: 'POST /auth/pairing-codes',
        body: { address: 'http://192.168.1.99:34345' },
    });
    expect(await card('Home network')).toHaveClass('place-card--current');
    expect(await card('This computer')).not.toHaveClass('place-card--current');
    expect(
        screen.getByRole('button', { name: 'Show the QR code for http://192.168.1.99:34345' }),
    ).toHaveAttribute('title', 'QR code shown');
});
it('announces the QR code when it changes', async () => {
    administrator(withAddresses(status()));

    renderPage();
    await card('Home network');

    expect(screen.getByRole('complementary', { name: 'QR code' })).toHaveAttribute(
        'aria-live',
        'polite',
    );
});
it('gives the HTTPS row its state as text', async () => {
    administrator(status(waiting));

    renderPage();
    await screen.findByRole('button', { name: 'Check again' });
    const https = row('HTTPS from the internet (recommended)');

    expect(within(https).getByText('Needs your help')).toBeInTheDocument();
    expect(
        within(https).getByText('Add the rule below in your router, then check again.'),
    ).toBeInTheDocument();
    expect(within(https).getByText('Add the rule in your router')).toBeInTheDocument();
});
it('marks HTTP to the internet closed, then open', async () => {
    administrator(status(undefined, false, { httpInternetAccess: httpOpen }));

    renderPage();
    await screen.findByRole('button', { name: 'Close HTTP' });

    expect(
        within(row('HTTP from the internet (not encrypted)')).getByText('Open'),
    ).toBeInTheDocument();
});
it('shows the HTTP port confirmation under the HTTP port row', async () => {
    administrator(status()).on('PUT /server-settings/http', () => ({
        status: 200,
        body: status(),
    }));

    renderPage();
    const form = await screen.findByRole('form', { name: 'HTTP / web interface' });

    await userEvent.click(within(form).getByRole('button', { name: 'Save HTTP port' }));

    expect(
        within(row('HTTP port')).getByText('HTTP port saved. This port is already active.'),
    ).toBeInTheDocument();
});
it('shows the HTTPS port confirmation under the HTTPS port row', async () => {
    administrator(status()).on('PUT /server-settings/https-port', () => ({
        status: 200,
        body: status(),
    }));

    renderPage();
    const form = await screen.findByRole('form', { name: 'HTTPS / internet access' });

    await userEvent.click(within(form).getByRole('button', { name: 'Save HTTPS port' }));

    expect(
        await within(row('HTTPS port')).findByText(/^HTTPS port saved. Close and reopen/),
    ).toBeInTheDocument();
});
it('says whether HTTPS is running in the HTTPS port row', async () => {
    administrator(status());

    renderPage();
    await card('Internet');

    expect(
        within(row('HTTPS port')).getByText('Phones outside your home. HTTPS is not running.'),
    ).toBeInTheDocument();
});
it('shows the addresses after applying the saved port under the HTTP port row', async () => {
    const current = status();

    administrator({ ...current, configured: { ...current.configured, http: { port: 4000 } } });

    renderPage();
    await card('Internet');

    expect(within(row('HTTP port')).getByText('http://127.0.0.1:4000')).toBeInTheDocument();
});
it('puts the restart notice above the cards', async () => {
    administrator(status(undefined, false, { restartRequired: true }));

    renderPage();
    const notice = await screen.findByText(/^Saved settings are waiting for a restart/);
    const cards = await card('This computer');

    expect(notice.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
it('gives the keep awake box its row title and explanation', async () => {
    administrator(status());

    renderPage();

    expect(
        await screen.findByRole('checkbox', {
            name: 'Keep this computer awake while Media Collection runs',
            description:
                'Leaf only works while this computer is on and awake. The screen can still turn off.',
        }),
    ).toBeInTheDocument();
});
it('keeps each address and its QR code button on one line', async () => {
    administrator(withAddresses(status()));

    renderPage();
    const button = await screen.findByRole('button', {
        name: 'Show the QR code for http://192.168.1.99:34345',
    });

    expect(button).toHaveAttribute('title', 'Show QR code');
    expect(button.closest('li')).toContainElement(
        screen.getByRole('link', { name: 'http://192.168.1.99:34345' }),
    );
});
it('closes the message of a stopped setup for good', async () => {
    const api = administrator(
        status(
            internetAccess({ failure: { reason: 'setup-failed', at: '2026-11-08T10:00:00.000Z' } }),
        ),
    ).on('DELETE /server-settings/internet-access/failure', () => ({
        status: 200,
        body: internetAccess(),
    }));

    renderPage();
    await screen.findByText('The setup stopped unexpectedly. Try again.');

    await userEvent.click(screen.getByRole('button', { name: 'Close message' }));

    expect(api.calls.map((call) => call.route)).toContain(
        'DELETE /server-settings/internet-access/failure',
    );
});
