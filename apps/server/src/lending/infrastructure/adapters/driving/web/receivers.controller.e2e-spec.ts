import { ReceiverBuilder } from '../../../../application/testing/receiver-builder.test-support.js';
import type { ReceiverDto } from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';

let app: TestApp;
const owner = new UserFixture({ username: 'camille', role: 'owner' });
const guest = new UserFixture({ username: 'morgan', role: 'guest' });

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([owner, guest]);
});
afterEach(async () => {
    await app?.teardown();
});

// Saves a receiver with the builders.
async function receiver(name: string) {
    const saved = await app.dependencies.builders.receiver(new ReceiverBuilder().withName(name));

    return { id: saved.id, name: saved.snapshot.name };
}

describe('GET /api/receivers', () => {
    it('suggests receivers whose name contains the search, ignoring case and accents', async () => {
        const zoe = await receiver('Zoé Martin');

        await receiver('Sam Taylor');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ReceiverDto[]>('/receivers?search=ZOE');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([zoe]);
    });
    it('suggests nothing without a search', async () => {
        await receiver('Sam Taylor');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ReceiverDto[]>('/receivers');

        expect(response.body).toEqual([]);
    });
    it('lets a Guest see receiver names', async () => {
        await receiver('Sam Taylor');
        const client = await app.authenticatedClient(guest);

        const response = await client.call<ReceiverDto[]>('/receivers?search=sam');

        expect(response.body.map((value) => value.name)).toEqual(['Sam Taylor']);
    });
    it('refuses an unknown parameter', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/receivers?name=sam');

        expect(response.status).toBe(400);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        const response = await client.call('/receivers?search=sam');

        expect(response.status).toBe(401);
    });
});
