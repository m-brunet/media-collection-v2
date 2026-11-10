export type BarcodeReading =
    | { kind: 'isbn'; isbn: string }
    | { kind: 'not-isbn' }
    | { kind: 'none' };

// Book barcodes are EAN-13 codes in the 978 and 979 "Bookland" ranges: their 13 digits are the
// ISBN-13 itself. Any other barcode (a price label, a shop code) is not an ISBN.
export class ScannedIsbn {
    static from(value: string): string | null {
        const digits = value.trim();

        if (!/^97[89]\d{10}$/.test(digits)) {
            return null;
        }

        return ScannedIsbn.checkDigitValid(digits) ? digits : null;
    }

    static reading(values: readonly string[]): BarcodeReading {
        const isbn = values.map((value) => ScannedIsbn.from(value)).find((value) => value !== null);

        if (isbn) {
            return { kind: 'isbn', isbn };
        }

        return values.length > 0 ? { kind: 'not-isbn' } : { kind: 'none' };
    }

    private static checkDigitValid(digits: string): boolean {
        const sum = [...digits.slice(0, 12)].reduce(
            (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
            0,
        );

        return (10 - (sum % 10)) % 10 === Number(digits[12]);
    }
}
