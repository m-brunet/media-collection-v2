import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerStatus } from '../../packages/contracts/src/http.js';
import type { Client } from './client.js';
import { RuntimeFixture, RuntimeSetup } from './runtime-setup.js';

let fixture: RuntimeFixture;

beforeEach(() => {
    fixture = new RuntimeFixture();
});
afterEach(async () => {
    await fixture.teardown();
});

// Reads the server settings once the internet access setup has finished.
async function settledStatus(client: Client): Promise<ServerStatus> {
    for (let attempt = 0; attempt < 50; attempt++) {
        const response = await client.call<ServerStatus>('/server-settings', 'GET');

        if (response.body.internetAccess.phase !== 'setting-up') {
            return response.body;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('The internet access setup did not finish.');
}

// Every test launch sets APP_OFFLINE_INTERNET_ACCESS: the real worker then never reaches a
// router, Let's Encrypt, the public address service or DNS.
describe('Internet access in a test launch of the real worker', () => {
    it('sets up HTTPS without reaching a router or Let’s Encrypt', async () => {
        const current = await fixture.start();

        await RuntimeSetup.administrator(current.client);

        await current.client.call('/server-settings/internet-access', 'POST', {});

        const status = await settledStatus(current.client);

        expect([
            status.internetAccess.phase,
            status.internetAccess.failure?.reason,
            status.internetAccess.certificate,
        ]).toEqual(['off', 'public-address-unknown', null]);
    });
    it('opens HTTP without reaching a router or the public address service', async () => {
        const current = await fixture.start();

        await RuntimeSetup.administrator(current.client);

        const response = await current.client.call<ServerStatus['httpInternetAccess']>(
            '/server-settings/internet-access/http',
            'POST',
        );

        expect([response.body.phase, response.body.failure?.reason]).toEqual([
            'off',
            'public-address-unknown',
        ]);
    });
    it('checks a domain name without reaching DNS', async () => {
        const current = await fixture.start();

        await RuntimeSetup.administrator(current.client);

        const response = await current.client.call('/server-settings/domain-name', 'PUT', {
            domain: 'home.example.fr',
        });

        expect([response.status, response.body]).toEqual([
            400,
            expect.objectContaining({ reason: 'public-address-unknown' }),
        ]);
    });
});
