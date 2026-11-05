import { describe, expect, it } from 'vitest';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { LocationFormat } from './location-format.util';

const bookcases: BookcaseDto[] = [
    {
        id: 'oak',
        name: 'Oak bookcase',
        bookCount: 3,
        shelves: [
            { id: 'shelf-1', bookcaseId: 'oak', name: 'Shelf 1', bookCount: 1 },
            { id: 'shelf-3', bookcaseId: 'oak', name: 'Shelf 3', bookCount: 2 },
        ],
    },
    { id: 'hall', name: 'Hall bookcase', bookCount: 0, shelves: [] },
];

describe('LocationFormat', () => {
    it('reads a location as its bookcase and shelf', () => {
        const location = { bookcaseName: 'Oak bookcase', shelfName: 'Shelf 3' };

        const result = LocationFormat.label(location);

        expect(result).toBe('Oak bookcase – Shelf 3');
    });
    it('finds the location of a shelf among the bookcases', () => {
        const shelfId = 'shelf-3';

        const result = LocationFormat.of(bookcases, shelfId);

        expect(result).toEqual({
            bookcaseId: 'oak',
            bookcaseName: 'Oak bookcase',
            shelfId: 'shelf-3',
            shelfName: 'Shelf 3',
        });
    });
    it('finds no location for an unknown shelf', () => {
        const shelfId = 'removed';

        const result = LocationFormat.of(bookcases, shelfId);

        expect(result).toBeNull();
    });
    it('reads a shelf filter choice as its location', () => {
        const value = 'shelf:shelf-3';

        const result = LocationFormat.choice(bookcases, value);

        expect(result).toBe('Oak bookcase – Shelf 3');
    });
    it('reads a bookcase filter choice as the bookcase name', () => {
        const value = 'bookcase:hall';

        const result = LocationFormat.choice(bookcases, value);

        expect(result).toBe('Hall bookcase');
    });
    it('reads a choice whose bookcases are not loaded yet as pending', () => {
        const value = 'shelf:unknown';

        const result = LocationFormat.choice([], value);

        expect(result).toBe('…');
    });
    it('reads the No location choice as no location', () => {
        const value = 'none';

        const result = LocationFormat.choice(bookcases, value);

        expect(result).toBeNull();
    });
});
