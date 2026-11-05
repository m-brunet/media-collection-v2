import { describe, expect, it } from 'vitest';
import { LocationName } from './location-name.value-object.js';

describe('LocationName', () => {
    it('keeps the label as typed without outer spaces', () => {
        const value = '  Oak bookcase ';

        const result = LocationName.of(value, 'bookcase');

        expect(result).toBe('Oak bookcase');
    });
    it('refuses an empty bookcase name', () => {
        const value = '   ';

        const result = () => LocationName.of(value, 'bookcase');

        expect(result).toThrow(expect.objectContaining({ reason: 'bookcase-name-invalid' }));
    });
    it('refuses a shelf name longer than 100 characters', () => {
        const value = 'x'.repeat(101);

        const result = () => LocationName.of(value, 'shelf');

        expect(result).toThrow(expect.objectContaining({ reason: 'shelf-name-invalid' }));
    });
});
