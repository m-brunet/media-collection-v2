import { expect, it } from 'vitest';
import { NameKey } from './name-key.helper.js';

it('ignores letter case', () => {
    const name = 'Tolkien';

    const result = NameKey.of(name) === NameKey.of('TOLKIEN');

    expect(result).toBe(true);
});

it('ignores accents', () => {
    const name = 'Hervé Bazin';

    const result = NameKey.of(name);

    expect(result).toBe('herve bazin');
});

it('ignores outer spaces', () => {
    const name = '  Ursula K. Le Guin ';

    const result = NameKey.of(name);

    expect(result).toBe('ursula k. le guin');
});

it('keeps inner spaces as they are', () => {
    const name = 'Le  Guin';

    const result = NameKey.of(name);

    expect(result).toBe('le  guin');
});

it('treats equivalent names as the same, not as merely similar', () => {
    const first = 'Émile Zola';

    const result = NameKey.similar(first, 'emile zola');

    expect(result).toBe(false);
});

it('finds a one-letter typo similar', () => {
    const first = 'Sam Taylor';

    const result = NameKey.similar(first, 'Sam Tayler');

    expect(result).toBe(true);
});

it('finds swapped letters similar', () => {
    const first = 'Herbert';

    const result = NameKey.similar(first, 'Hebrert');

    expect(result).toBe(true);
});

it('finds a name contained in a longer one similar', () => {
    const first = 'Tolkien';

    const result = NameKey.similar(first, 'J. R. R. Tolkien');

    expect(result).toBe(true);
});

it('does not find unrelated names similar', () => {
    const first = 'Frank Herbert';

    const result = NameKey.similar(first, 'Ursula K. Le Guin');

    expect(result).toBe(false);
});

it('does not find a short name similar to a longer word containing it', () => {
    const first = 'Ann';

    const result = NameKey.similar(first, 'Anne Rice');

    expect(result).toBe(false);
});
