import { expect, it } from 'vitest';
import { ScannedIsbn } from './scanned-isbn.util';

it('reads the ISBN-13 of a 978 book barcode', () => {
    const result = ScannedIsbn.from('9781635575637');

    expect(result).toBe('9781635575637');
});

it('reads the ISBN-13 of a 979 book barcode', () => {
    const result = ScannedIsbn.from('9791032705858');

    expect(result).toBe('9791032705858');
});

it('ignores spaces around the barcode value', () => {
    const result = ScannedIsbn.from(' 9781635575637 ');

    expect(result).toBe('9781635575637');
});

it('rejects an EAN-13 outside the book ranges', () => {
    const result = ScannedIsbn.from('3017620422003');

    expect(result).toBeNull();
});

it('rejects a book barcode with a wrong check digit', () => {
    const result = ScannedIsbn.from('9781635575630');

    expect(result).toBeNull();
});

it('rejects a value that is not thirteen digits', () => {
    const result = ScannedIsbn.from('978163557563');

    expect(result).toBeNull();
});

it('finds the ISBN among the barcodes read in a picture', () => {
    const result = ScannedIsbn.reading(['3017620422003', '9781635575637']);

    expect(result).toEqual({ kind: 'isbn', isbn: '9781635575637' });
});

it('reports barcodes that are not ISBNs', () => {
    const result = ScannedIsbn.reading(['3017620422003']);

    expect(result).toEqual({ kind: 'not-isbn' });
});

it('reports a picture without any barcode', () => {
    const result = ScannedIsbn.reading([]);

    expect(result).toEqual({ kind: 'none' });
});
