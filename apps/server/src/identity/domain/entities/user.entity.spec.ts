import { expect, it } from 'vitest';
import { User } from './user.entity.js';

const state = {
    id: 'owner',
    username: ' Owner ',
    role: 'admin' as const,
    passwordHash: 'hash',
    mustChangePassword: true,
    language: null as 'en' | 'fr' | null,
    tokenVersion: 0,
    createdAt: '2026-01-01T00:00:00Z',
    active: true,
};

it('normalizes usernames at construction', () => {
    const input = { ...state };

    const user = new User(input);

    expect(user.actor.username).toBe('owner');
    expect(user.actor).not.toHaveProperty('passwordHash');
});
it('rejects punctuation in a username', () => {
    const username = '!';
    const input = { ...state, username };

    const operation = () => new User(input);

    expect(operation).toThrow();
});
it('rejects a short username', () => {
    const username = 'ab';
    const input = { ...state, username };

    const operation = () => new User(input);

    expect(operation).toThrow();
});
it('rejects an overlong username', () => {
    const username = 'x'.repeat(41);
    const input = { ...state, username };

    const operation = () => new User(input);

    expect(operation).toThrow();
});
it('renames with normalization', () => {
    const user = new User(state);

    user.rename(' Renamed ');

    expect(user.actor.username).toBe('renamed');
});
it('replaces the password without mandatory setup', () => {
    const temporary = false;
    const user = new User(state);

    user.replacePassword('replacement', temporary);

    expect(user.snapshot).toMatchObject({
        passwordHash: 'replacement',
        tokenVersion: 1,
        mustChangePassword: temporary,
    });
});
it('replaces the password with mandatory setup', () => {
    const temporary = true;
    const user = new User(state);

    user.replacePassword('replacement', temporary);

    expect(user.snapshot).toMatchObject({
        passwordHash: 'replacement',
        tokenVersion: 1,
        mustChangePassword: temporary,
    });
});
it('returns independent snapshot state', () => {
    const user = new User(state);
    const snapshot = user.snapshot;

    snapshot.username = 'tampered';

    expect(user.snapshot.username).toBe('owner');
});
it('rejects a short password', () => {
    const password = 'short';

    const operation = () => User.validatePassword(password);

    expect(operation).toThrow();
});
it('rejects an overlong password', () => {
    const password = 'x'.repeat(129);

    const operation = () => User.validatePassword(password);

    expect(operation).toThrow();
});
it('accepts the minimum password length', () => {
    const password = '12345678';

    const operation = () => User.validatePassword(password);

    expect(operation).not.toThrow();
});
it('accepts the maximum password length', () => {
    const password = 'x'.repeat(128);

    const operation = () => User.validatePassword(password);

    expect(operation).not.toThrow();
});
it('rejects an empty replacement hash', () => {
    const user = new User(state);

    const operation = () => user.replacePassword('');

    expect(operation).toThrow();
    expect(user.snapshot.tokenVersion).toBe(0);
});
it('starts without a chosen interface language', () => {
    const input = { ...state };

    const user = new User(input);

    expect(user.actor.language).toBeNull();
});
it('records a chosen interface language', () => {
    const user = new User(state);

    user.chooseLanguage('fr');

    expect(user.actor.language).toBe('fr');
    expect(user.snapshot.tokenVersion).toBe(0);
});
it('rejects an unsupported stored interface language', () => {
    const input = { ...state, language: 'de' as 'en' };

    const operation = () => new User(input);

    expect(operation).toThrow('English or French');
});
it('accepts the owner and guest roles', () => {
    const owner = { ...state, role: 'owner' as const };

    const operation = () => [new User(owner), new User({ ...state, role: 'guest' })];

    expect(operation).not.toThrow();
});
it('rejects an unknown role', () => {
    const input = { ...state, role: 'user' as 'owner' };

    const operation = () => new User(input);

    expect(operation).toThrow('Invalid account role.');
});
it('summarises an account without credentials', () => {
    const user = new User({ ...state, role: 'owner' });

    const result = user.summary;

    expect(result).toEqual({
        id: 'owner',
        username: 'owner',
        role: 'owner',
        mustChangePassword: true,
        active: true,
    });
});
it('deactivates another account and ends its sessions', () => {
    const user = new User({ ...state, role: 'guest' });

    user.deactivate();

    expect(user.isActive).toBe(false);
    expect(user.snapshot.tokenVersion).toBe(1);
});
it('refuses to deactivate the protected administrator', () => {
    const user = new User(state);

    const operation = () => user.deactivate();

    expect(operation).toThrow(
        expect.objectContaining({ code: 'forbidden', reason: 'protected-administrator' }),
    );
    expect(user.isActive).toBe(true);
});
it('refuses to deactivate an account twice', () => {
    const user = new User({ ...state, role: 'owner', active: false });

    const operation = () => user.deactivate();

    expect(operation).toThrow(expect.objectContaining({ reason: 'already-inactive' }));
});
it('reactivates an account with its original role', () => {
    const user = new User({ ...state, role: 'guest', active: false });

    user.reactivate();

    expect(user.summary).toMatchObject({ role: 'guest', active: true });
});
it('refuses to reactivate an active account', () => {
    const user = new User({ ...state, role: 'owner' });

    const operation = () => user.reactivate();

    expect(operation).toThrow(expect.objectContaining({ reason: 'already-active' }));
});
it('identifies the protected administrator', () => {
    const user = new User(state);

    const result = user.isProtectedAdministrator;

    expect(result).toBe(true);
});
it('lets the administrator manage an owner', () => {
    const user = new User({ ...state, role: 'owner' });

    const operation = () => user.ensureManageable();

    expect(operation).not.toThrow();
});
