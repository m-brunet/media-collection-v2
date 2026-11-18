import { describe, expect, it } from 'vitest';
import { BookcaseSize } from './bookcase-size.value-object.js';

describe('BookcaseSize', () => {
    it('accepts a Large bookcase', () => {
        const value = 'large';

        const result = BookcaseSize.of(value);

        expect(result).toBe('large');
    });
    it('accepts a Small bookcase', () => {
        const value = 'small';

        const result = BookcaseSize.of(value);

        expect(result).toBe('small');
    });
    it('refuses another size', () => {
        const value = 'medium';

        const result = () => BookcaseSize.of(value);

        expect(result).toThrow(expect.objectContaining({ reason: 'bookcase-size-invalid' }));
    });
    it('makes a new bookcase Large', () => {
        const result = BookcaseSize.initial;

        expect(result).toBe('large');
    });
});
