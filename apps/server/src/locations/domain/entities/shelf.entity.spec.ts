import { describe, expect, it } from 'vitest';
import { Shelf } from './shelf.entity.js';

const top = () =>
    new Shelf({
        id: 'top',
        bookcaseId: 'oak',
        name: 'Top ',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    });

describe('Shelf', () => {
    it('keeps its label and compares names without case or outer spaces', () => {
        const shelf = top();

        const result = shelf.key;

        expect(result).toBe('top');
        expect(shelf.snapshot.name).toBe('Top');
    });
    it('renames', () => {
        const shelf = top();

        shelf.rename('Middle', '2026-02-01T00:00:00.000Z');

        expect(shelf.snapshot).toMatchObject({
            name: 'Middle',
            updatedAt: '2026-02-01T00:00:00.000Z',
        });
    });
    it('moves to another bookcase', () => {
        const shelf = top();

        shelf.moveTo('study', '2026-02-01T00:00:00.000Z');

        expect(shelf.snapshot).toMatchObject({ bookcaseId: 'study', name: 'Top' });
    });
    it('refuses an empty name', () => {
        const shelf = top();

        const result = () => shelf.rename('', '2026-02-01T00:00:00.000Z');

        expect(result).toThrow(expect.objectContaining({ reason: 'shelf-name-invalid' }));
    });
});
