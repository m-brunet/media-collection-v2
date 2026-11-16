import { describe, expect, it } from 'vitest';
import { ShelfBookFormat } from './shelf-book-format.util';

describe('ShelfBookFormat', () => {
    it('names the collection of a book with its volume', () => {
        const book = { collection: { name: 'Discworld', volumeFrom: 4, volumeTo: 4 } };

        const text = ShelfBookFormat.collection(book, 'None');

        expect(text).toBe('Discworld · 4');
    });
    it('gives the range of a book that holds several volumes', () => {
        const book = { collection: { name: 'Dune', volumeFrom: 1, volumeTo: 3 } };

        const text = ShelfBookFormat.collection(book, 'None');

        expect(text).toBe('Dune · 1–3');
    });
    it('says when a book is in no collection', () => {
        const text = ShelfBookFormat.collection({ collection: null }, 'None');

        expect(text).toBe('None');
    });
});
