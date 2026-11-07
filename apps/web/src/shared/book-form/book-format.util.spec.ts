import { describe, expect, it } from 'vitest';
import { BookFormat } from './book-format.util';

describe('BookFormat', () => {
    it('shows a price with exactly two decimals', () => {
        const result = BookFormat.price(1690, 'en-GB');

        expect(result).toBe('€16.90');
    });
    it('shows a free book as zero, not as unknown', () => {
        const result = BookFormat.price(0, 'fr-FR');

        expect(result.replace(/\s/g, ' ')).toBe('0,00 €');
    });
    it('fills the price field with the language decimal separator', () => {
        const result = BookFormat.priceInput(1250, 'fr-FR');

        expect(result).toBe('12,50');
    });
    it('shows a month and year publication date', () => {
        const result = BookFormat.publication(2020, 9, 'en-GB');

        expect(result).toBe('September 2020');
    });
    it('shows a year-only publication date', () => {
        const result = BookFormat.publication(2020, null, 'fr-FR');

        expect(result).toBe('2020');
    });
    it('names a month in the interface language', () => {
        const result = BookFormat.monthName(3, 'fr-FR');

        expect(result).toBe('mars');
    });
});
