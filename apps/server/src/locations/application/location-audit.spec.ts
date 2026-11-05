import { describe, expect, it } from 'vitest';
import { Bookcase } from '../domain/entities/bookcase.entity.js';
import { Shelf } from '../domain/entities/shelf.entity.js';
import { LocationSnapshot } from './location-audit.js';

const at = '2026-01-01T00:00:00.000Z';
const oak = () => new Bookcase({ id: 'oak', name: 'Oak', createdAt: at, updatedAt: at });

describe('LocationSnapshot', () => {
    it('records a bookcase by its name', () => {
        const bookcase = oak();

        const result = LocationSnapshot.bookcase(bookcase);

        expect(result).toEqual({ name: 'Oak' });
    });
    it('records a shelf with its bookcase', () => {
        const shelf = new Shelf({
            id: 'top',
            bookcaseId: 'oak',
            name: 'Top',
            createdAt: at,
            updatedAt: at,
        });

        const result = LocationSnapshot.shelf(shelf, oak());

        expect(result).toEqual({ name: 'Top', bookcaseId: 'oak', bookcaseName: 'Oak' });
    });
});
