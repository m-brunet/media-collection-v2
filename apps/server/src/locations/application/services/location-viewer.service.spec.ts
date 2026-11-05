import { describe, expect, it } from 'vitest';
import { Bookcase } from '../../domain/entities/bookcase.entity.js';
import { Shelf } from '../../domain/entities/shelf.entity.js';
import { LocationViewer } from './location-viewer.service.js';

const at = '2026-01-01T00:00:00.000Z';
const oak = new Bookcase({ id: 'oak', name: 'Oak', createdAt: at, updatedAt: at });
const shelf = (id: string, name: string, bookcaseId = 'oak') =>
    new Shelf({ id, bookcaseId, name, createdAt: at, updatedAt: at });

describe('LocationViewer', () => {
    it('lists the shelves of a bookcase in natural name order with their books', () => {
        const shelves = [
            shelf('s10', 'Shelf 10'),
            shelf('s2', 'Shelf 2'),
            shelf('x', 'Top', 'study'),
        ];
        const counts = new Map([
            ['s2', 3],
            ['s10', 4],
            ['x', 9],
        ]);

        const result = new LocationViewer().bookcase(oak, shelves, counts);

        expect(result).toEqual({
            id: 'oak',
            name: 'Oak',
            bookCount: 7,
            shelves: [
                { id: 's2', bookcaseId: 'oak', name: 'Shelf 2', bookCount: 3 },
                { id: 's10', bookcaseId: 'oak', name: 'Shelf 10', bookCount: 4 },
            ],
        });
    });
    it('shows an empty shelf with no books', () => {
        const empty = shelf('s4', 'Shelf 4');

        const result = new LocationViewer().shelf(empty, new Map());

        expect(result.bookCount).toBe(0);
    });
    it('orders bookcases by name ignoring case', () => {
        const views = [
            { id: 'b', name: 'study', bookCount: 0, shelves: [] },
            { id: 'a', name: 'Hall', bookCount: 0, shelves: [] },
        ];

        const result = new LocationViewer().sorted(views);

        expect(result.map((view) => view.name)).toEqual(['Hall', 'study']);
    });
});
