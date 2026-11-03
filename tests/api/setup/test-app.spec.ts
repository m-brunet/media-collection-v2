import { afterEach, beforeEach, expect, it } from 'vitest';
import { TestApp } from './test-app.js';
import { UserFixture } from '../fixtures/user.fixture.js';
import { NoteFixture } from '../fixtures/note.fixture.js';

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

it('loads related fixtures in order with real hashing and ownership', async () => {
    const user = new UserFixture({ username: 'owner' });
    const note = new NoteFixture(user.id);

    await app.loadFixtures([user, note]);

    const persisted = (await app.dependencies.users.findById(user.id))!;

    expect(persisted.snapshot.passwordHash).not.toBe(user.password);
    expect(
        await app.dependencies.passwords.matches(user.password, persisted.snapshot.passwordHash),
    ).toBe(true);
    expect((await app.dependencies.notes.find(user.id, note.getId()))!.snapshot.ownerId).toBe(
        user.id,
    );
});

it('rejects a Note fixture without its owner instead of weakening foreign keys', async () => {
    const fixture = new NoteFixture('absent');

    const result = app.loadFixtures([fixture]);

    await expect(result).rejects.toThrow(/FOREIGN KEY/);
    expect(await app.dependencies.notes.list('absent')).toEqual([]);
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
