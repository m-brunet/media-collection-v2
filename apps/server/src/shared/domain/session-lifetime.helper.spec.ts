import { expect, it } from 'vitest';
import { SessionLifetime } from './session-lifetime.helper.js';

it('lasts 24 hours in seconds', () => {
    const expected = 86_400;

    const result = SessionLifetime.seconds;

    expect(result).toBe(expected);
});
it('gives the same lifetime in milliseconds', () => {
    const expected = 86_400_000;

    const result = SessionLifetime.milliseconds;

    expect(result).toBe(expected);
});
