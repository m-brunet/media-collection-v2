import { describe, expect, it } from 'vitest';
import { Ranking } from './ranking.service.js';

describe('Ranking', () => {
    it('keeps the ten highest values', () => {
        const entries = Array.from({ length: 11 }, (_, index) => ({
            name: 'Name ' + index,
            count: index,
        }));

        const top = Ranking.top(entries, (entry) => entry.count);

        expect(top.map((entry) => entry.count)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    });
    it('orders equal values by name, ignoring case and accents', () => {
        const entries = [
            { name: 'kana', count: 2 },
            { name: 'Éditions Delcourt', count: 2 },
            { name: 'Glénat', count: 2 },
        ];

        const top = Ranking.top(entries, (entry) => entry.count);

        expect(top.map((entry) => entry.name)).toEqual(['Éditions Delcourt', 'Glénat', 'kana']);
    });
});
