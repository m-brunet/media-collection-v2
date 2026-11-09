import { expect, it } from 'vitest';
import { ColorScheme } from './color-scheme.value-object.js';

it('uses Spring green by default', () => {
    const scheme = ColorScheme.default;

    const result = scheme.name;

    expect(result).toBe('spring-green');
});

it('accepts each available scheme', () => {
    const names = [
        'spring-green',
        'midnight-blue',
        'velvet-violet',
        'ember',
        'rose-noir',
        'graphite-gold',
        'slate-orchid',
        'charcoal-scarlet',
    ];

    const result = names.map((name) => new ColorScheme(name).name);

    expect(result).toEqual(names);
});

it('rejects an unknown scheme', () => {
    const name = 'purple';

    const operation = () => new ColorScheme(name);

    expect(operation).toThrow(
        expect.objectContaining({ code: 'invalid_input', reason: 'color-scheme-unknown' }),
    );
});

it('rejects Mint, no longer offered', () => {
    const name = 'mint';

    const operation = () => new ColorScheme(name);

    expect(operation).toThrow(expect.objectContaining({ reason: 'color-scheme-unknown' }));
});

it('rejects Emerald, no longer offered', () => {
    const name = 'emerald';

    const operation = () => new ColorScheme(name);

    expect(operation).toThrow(expect.objectContaining({ reason: 'color-scheme-unknown' }));
});

it('rejects Forest, no longer offered', () => {
    const name = 'forest';

    const operation = () => new ColorScheme(name);

    expect(operation).toThrow(expect.objectContaining({ reason: 'color-scheme-unknown' }));
});
