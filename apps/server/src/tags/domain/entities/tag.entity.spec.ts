import { describe, expect, it } from 'vitest';
import { Tag } from './tag.entity.js';

const fantasy = () =>
    new Tag({
        id: 'fantasy',
        name: ' Fantasy ',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    });

describe('Tag', () => {
    it('keeps its label with accents and compares without them', () => {
        const tag = new Tag({
            id: 'medieval',
            name: 'Médiéval',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        });

        const result = tag.key;

        expect(result).toBe('medieval');
        expect(tag.snapshot.name).toBe('Médiéval');
    });
    it('trims outer spaces from its label', () => {
        const tag = fantasy();

        const result = tag.snapshot.name;

        expect(result).toBe('Fantasy');
    });
    it('renames', () => {
        const tag = fantasy();

        tag.rename('High fantasy', '2026-02-01T00:00:00.000Z');

        expect(tag.snapshot).toMatchObject({
            name: 'High fantasy',
            updatedAt: '2026-02-01T00:00:00.000Z',
        });
    });
    it('refuses an empty name', () => {
        const tag = fantasy();

        const result = () => tag.rename('  ', '2026-02-01T00:00:00.000Z');

        expect(result).toThrow(expect.objectContaining({ reason: 'tag-name-invalid' }));
    });
    it('refuses a name longer than 100 characters', () => {
        const value = 'x'.repeat(101);

        const result = () => Tag.validName(value);

        expect(result).toThrow(expect.objectContaining({ reason: 'tag-name-invalid' }));
    });
});
