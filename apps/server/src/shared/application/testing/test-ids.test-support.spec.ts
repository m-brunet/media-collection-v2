import { expect, it } from 'vitest';
import { TestIds } from './test-ids.test-support.js';

it('gives identities in the UUID format the database accepts', () => {
    const format = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    const result = TestIds.next();

    expect(result).toMatch(format);
});

it('never gives the same identity twice', () => {
    const first = TestIds.next();

    const result = TestIds.next();

    expect(result).not.toBe(first);
});

it('gives increasing numbers for unique default names', () => {
    const first = TestIds.sequence();

    const result = TestIds.sequence();

    expect(result).toBeGreaterThan(first);
});
