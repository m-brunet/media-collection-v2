import { afterEach, beforeEach, expect, it } from 'vitest';
import { TestApp } from './test-app.js';
import { UserFixture } from '../fixtures/user.fixture.js';

let app: TestApp;
let other: TestApp | undefined;

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
});
afterEach(async () => {
    try {
        await app.teardown();
    } finally {
        await other?.teardown();
        other = undefined;
    }
});

it('loads fixtures with real password hashing', async () => {
    const user = new UserFixture({ username: 'owner' });

    await app.loadFixtures([user]);

    const persisted = (await app.dependencies.users.findById(user.id))!;

    expect(persisted.snapshot.passwordHash).not.toBe(user.password);
    expect(
        await app.dependencies.passwords.matches(user.password, persisted.snapshot.passwordHash),
    ).toBe(true);
});

it('isolates data between simultaneously initialized test applications', async () => {
    const user = new UserFixture({ username: 'owner' });

    await app.loadFixtures([user]);
    other = new TestApp();

    await other.setup();

    expect(await other.dependencies.users.list()).toEqual([]);
    expect(await app.dependencies.users.list()).toHaveLength(1);
});

it('keeps authentication cookies independent between clients', async () => {
    const user = new UserFixture({ username: 'owner' });

    await app.loadFixtures([user]);
    const anonymous = app.client();

    const authenticated = await app.authenticatedClient(user);

    expect(authenticated.cookies.get('app_auth')).toBeTruthy();
    expect(anonymous.cookies.has('app_auth')).toBe(false);
});
