import { describe, expect, it } from 'vitest';
import { Bookcase } from './bookcase.entity.js';

const oak = () =>
    new Bookcase({
        id: 'oak',
        name: ' Oak bookcase ',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    });

describe('Bookcase', () => {
    it('keeps its label and compares names without case or accents', () => {
        const bookcase = oak();

        const result = bookcase.key;

        expect(result).toBe('oak bookcase');
        expect(bookcase.snapshot.name).toBe('Oak bookcase');
    });
    it('renames', () => {
        const bookcase = oak();

        bookcase.rename('Chêne', '2026-02-01T00:00:00.000Z');

        expect(bookcase.snapshot).toMatchObject({
            name: 'Chêne',
            updatedAt: '2026-02-01T00:00:00.000Z',
        });
    });
    it('refuses an empty name', () => {
        const bookcase = oak();

        const result = () => bookcase.rename(' ', '2026-02-01T00:00:00.000Z');

        expect(result).toThrow(expect.objectContaining({ reason: 'bookcase-name-invalid' }));
    });
});
