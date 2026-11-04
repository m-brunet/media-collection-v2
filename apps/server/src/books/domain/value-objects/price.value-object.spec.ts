import { expect, it } from 'vitest';
import { Price } from './price.value-object.js';

it('reads a price with a dot', () => {
    const text = '16.90';

    const result = Price.parse(text);

    expect(result.cents).toBe(1690);
});

it('reads a price with a comma', () => {
    const text = '16,9';

    const result = Price.parse(text);

    expect(result.cents).toBe(1690);
});

it('reads a whole number of euros', () => {
    const text = '12';

    const result = Price.parse(text);

    expect(result.cents).toBe(1200);
});

it('keeps zero as free', () => {
    const text = '0';

    const result = Price.parse(text);

    expect(result.cents).toBe(0);
});

it('rejects a negative price', () => {
    const text = '-1';

    const operation = () => Price.parse(text);

    expect(operation).toThrow(expect.objectContaining({ reason: 'price-invalid' }));
});

it('rejects more than two decimals', () => {
    const text = '1.999';

    const operation = () => Price.parse(text);

    expect(operation).toThrow(expect.objectContaining({ reason: 'price-invalid' }));
});
