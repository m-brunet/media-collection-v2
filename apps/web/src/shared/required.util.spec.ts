import { expect, it } from 'vitest';
import { Required } from './required.util';

it('returns a present value', () => {
    const value: string | undefined = 'Dune';

    const result = Required.value(value, 'a title is known');

    expect(result).toBe('Dune');
});

it('keeps a falsy value that is present', () => {
    const value: number | null = 0;

    const result = Required.value(value, 'a count is known');

    expect(result).toBe(0);
});

it('refuses a missing value with the reason', () => {
    const value: string | undefined = undefined;

    const act = () => Required.value(value, 'a title is known');

    expect(act).toThrow('a title is known');
});

it('refuses a null value with the reason', () => {
    const value: string | null = null;

    const act = () => Required.value(value, 'a title is known');

    expect(act).toThrow('a title is known');
});

it('returns the item at an index', () => {
    const items = ['first', 'second'];

    const result = Required.at(items, 1, 'two items exist');

    expect(result).toBe('second');
});

it('refuses an index past the end with the reason', () => {
    const items = ['first'];

    const act = () => Required.at(items, 1, 'two items exist');

    expect(act).toThrow('two items exist');
});
