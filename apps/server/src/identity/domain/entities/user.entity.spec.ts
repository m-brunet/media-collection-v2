import { expect, it } from 'vitest';
import { User } from './user.entity.js';

const state = {
    id: 'owner',
    username: ' Owner ',
    role: 'admin' as const,
    passwordHash: 'hash',
    mustChangePassword: true,
    tokenVersion: 0,
    createdAt: '2026-01-01T00:00:00Z',
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
