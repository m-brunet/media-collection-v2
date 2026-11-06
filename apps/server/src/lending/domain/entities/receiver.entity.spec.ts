import { describe, expect, it } from 'vitest';
import { Receiver } from './receiver.entity.js';

describe('Receiver', () => {
    it('keeps its label with accents and compares without them', () => {
        const receiver = new Receiver({
            id: 'zoe',
            name: 'Zoé Martin',
            createdAt: '2026-01-01T00:00:00.000Z',
        });

        const result = receiver.key;

        expect(result).toBe('zoe martin');
        expect(receiver.snapshot.name).toBe('Zoé Martin');
    });
    it('trims outer spaces from its label', () => {
        const receiver = new Receiver({
            id: 'sam',
            name: '  Sam Taylor ',
            createdAt: '2026-01-01T00:00:00.000Z',
        });

        const result = receiver.snapshot.name;

        expect(result).toBe('Sam Taylor');
    });
    it('treats names differing only by case as equivalent', () => {
        const first = new Receiver({ id: 'a', name: 'Sam', createdAt: '2026-01-01T00:00:00.000Z' });

        const result = new Receiver({
            id: 'b',
            name: 'SAM',
            createdAt: '2026-01-01T00:00:00.000Z',
        });

        expect(result.key).toBe(first.key);
    });
    it('refuses a blank name', () => {
        const value = '   ';

        const result = () => Receiver.validName(value);

        expect(result).toThrow(expect.objectContaining({ reason: 'receiver-name-invalid' }));
    });
    it('refuses a name longer than 100 characters', () => {
        const value = 'x'.repeat(101);

        const result = () => Receiver.validName(value);

        expect(result).toThrow(expect.objectContaining({ reason: 'receiver-name-invalid' }));
    });
    it('accepts a name of exactly 100 characters', () => {
        const value = 'x'.repeat(100);

        const result = Receiver.validName(value);

        expect(result).toHaveLength(100);
    });
});
