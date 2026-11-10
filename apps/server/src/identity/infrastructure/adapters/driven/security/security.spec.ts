import { expect, it } from 'vitest';
import { ScryptPasswordHasher } from './scrypt-password-hasher.adapter.js';
import { JwtSessionTokens } from './jwt-session-tokens.adapter.js';

const claims = { userId: 'user', version: 2, restricted: false };

it('produces salted hashes without the plaintext', async () => {
    const hasher = new ScryptPasswordHasher();
    const previous = await hasher.hash('password-to-protect');

    const result = await hasher.hash('password-to-protect');

    expect(result).not.toContain('password-to-protect');
    expect(result).not.toBe(previous);
});
it('matches the correct password', async () => {
    const password = 'password-to-protect';
    const expected = true;
    const hasher = new ScryptPasswordHasher();
    const hash = await hasher.hash('password-to-protect');

    const result = await hasher.matches(password, hash);

    expect(result).toBe(expected);
});
it('rejects an incorrect password', async () => {
    const password = 'incorrect';
    const expected = false;
    const hasher = new ScryptPasswordHasher();
    const hash = await hasher.hash('password-to-protect');

    const result = await hasher.matches(password, hash);

    expect(result).toBe(expected);
});
it('rejects unknown hash formats', async () => {
    const hasher = new ScryptPasswordHasher();
    const hash = 'bad:format';

    const result = await hasher.matches('password', hash);

    expect(result).toBe(false);
});
it('accepts a newly issued token', async () => {
    const elapsed = 0;
    let now = new Date('2026-01-01T00:00:00Z');
    const clock = { now: () => now };
    const tokens = new JwtSessionTokens(new Uint8Array(32).fill(7), clock);
    const token = await tokens.issue(claims);

    now = new Date(now.getTime() + elapsed * 1000);

    const result = await tokens.verify(token);

    expect(result).toEqual(elapsed < 86_400 ? claims : null);
});
it('accepts a token just before expiry', async () => {
    const elapsed = 86_399;
    let now = new Date('2026-01-01T00:00:00Z');
    const clock = { now: () => now };
    const tokens = new JwtSessionTokens(new Uint8Array(32).fill(7), clock);
    const token = await tokens.issue(claims);

    now = new Date(now.getTime() + elapsed * 1000);

    const result = await tokens.verify(token);

    expect(result).toEqual(elapsed < 86_400 ? claims : null);
});
it('rejects a token at expiry', async () => {
    const elapsed = 86_400;
    let now = new Date('2026-01-01T00:00:00Z');
    const clock = { now: () => now };
    const tokens = new JwtSessionTokens(new Uint8Array(32).fill(7), clock);
    const token = await tokens.issue(claims);

    now = new Date(now.getTime() + elapsed * 1000);

    const result = await tokens.verify(token);

    expect(result).toEqual(elapsed < 86_400 ? claims : null);
});
it('rejects another signing key', async () => {
    const clock = { now: () => new Date('2026-01-01T00:00:00Z') };
    const token = await new JwtSessionTokens(new Uint8Array(32).fill(7), clock).issue(claims);
    const tokens = new JwtSessionTokens(new Uint8Array(32).fill(8), clock);

    const result = await tokens.verify(token);

    expect(result).toBeNull();
});
it('rejects malformed tokens', async () => {
    const tokens = new JwtSessionTokens(new Uint8Array(32).fill(7), { now: () => new Date() });
    const token = 'malformed';

    const result = await tokens.verify(token);

    expect(result).toBeNull();
});
