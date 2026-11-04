import { Failure } from '../../../shared/domain/exceptions/failure.js';

// An edition's ISBN, always kept as ISBN-13. A valid ISBN-10 is converted to its ISBN-13
// equivalent, and the conversion is remembered so the interface can explain it.
export class Isbn {
    private constructor(
        readonly isbn13: string,
        readonly convertedFromIsbn10: boolean,
    ) {
        Object.freeze(this);
    }

    static parse(input: string): Isbn {
        const compact = Isbn.compact(input);

        if (compact.length === 10 && Isbn.validIsbn10(compact)) {
            return new Isbn(Isbn.toIsbn13(compact), true);
        }

        Failure.ensure(
            compact.length === 13 && Isbn.validIsbn13(compact),
            'Enter a valid ISBN-10 or ISBN-13.',
            'isbn-invalid',
        );

        return new Isbn(compact, false);
    }

    static stored(isbn13: string, convertedFromIsbn10: boolean): Isbn {
        Failure.ensure(Isbn.validIsbn13(isbn13), 'A stored ISBN-13 is invalid.');

        return new Isbn(isbn13, convertedFromIsbn10);
    }

    // The ISBN-13 a search text stands for, when it is a complete valid ISBN-10 or ISBN-13.
    static equivalent(input: string): string | null {
        const compact = Isbn.compact(input);

        if (compact.length === 10 && Isbn.validIsbn10(compact)) {
            return Isbn.toIsbn13(compact);
        }

        return compact.length === 13 && Isbn.validIsbn13(compact) ? compact : null;
    }

    private static compact(input: string): string {
        return input.replace(/[\s-]/g, '').toUpperCase();
    }

    private static validIsbn10(value: string): boolean {
        if (!/^\d{9}[\dX]$/.test(value)) {
            return false;
        }

        const sum = [...value].reduce(
            (total, digit, index) => total + (digit === 'X' ? 10 : Number(digit)) * (10 - index),
            0,
        );

        return sum % 11 === 0;
    }

    private static validIsbn13(value: string): boolean {
        if (!/^\d{13}$/.test(value)) {
            return false;
        }

        return Isbn.checkDigit13(value.slice(0, 12)) === Number(value[12]);
    }

    private static toIsbn13(isbn10: string): string {
        const stem = '978' + isbn10.slice(0, 9);

        return stem + Isbn.checkDigit13(stem);
    }

    private static checkDigit13(twelve: string): number {
        const sum = [...twelve].reduce(
            (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
            0,
        );

        return (10 - (sum % 10)) % 10;
    }
}
