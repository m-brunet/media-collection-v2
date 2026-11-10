import { Failure } from '../../../shared/domain/exceptions/failure.js';

// A book price in euros, kept in cents. Zero means obtained free; "unknown" is no price at all.
export class Price {
    private constructor(readonly cents: number) {
        Object.freeze(this);
    }

    static parse(text: string): Price {
        const value = text.trim().replace(',', '.');

        Failure.ensure(
            /^\d{1,7}(\.\d{1,2})?$/.test(value),
            'Enter a price in euros with at most two decimals, for example 16.90.',
            'price-invalid',
        );

        const [whole, fraction = ''] = value.split('.');

        return new Price(Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
    }

    static fromCents(cents: number): Price {
        Failure.ensure(Number.isInteger(cents) && cents >= 0, 'A stored price is invalid.');

        return new Price(cents);
    }
}
