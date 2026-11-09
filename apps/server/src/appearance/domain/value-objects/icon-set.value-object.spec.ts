import { expect, it } from 'vitest';
import { IconSet } from './icon-set.value-object.js';

it('uses Lucide by default', () => {
    const set = IconSet.default;

    const result = set.name;

    expect(result).toBe('lucide');
});
it('accepts each available icon set', () => {
    const names = [
        'lucide',
        'solid-silhouettes',
        'hand-inked-editorial',
        'architectural-wireframes',
        'single-ink-risograph',
        'quiet-editorial-monoline',
    ];

    const result = names.map((name) => new IconSet(name).name);

    expect(result).toEqual(names);
});
it('rejects an unknown icon set', () => {
    const name = 'emoji';

    const operation = () => new IconSet(name);

    expect(operation).toThrow(
        expect.objectContaining({ code: 'invalid_input', reason: 'icon-set-unknown' }),
    );
});
