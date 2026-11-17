import { describe, expect, it } from 'vitest';
import { PublisherNames } from './publisher-names.value-object.js';

describe('PublisherNames', () => {
    it('gives the spelling of the same key, ignoring case, accents and outer spaces', () => {
        const names = PublisherNames.of([{ name: 'Glénat', books: 2 }]);

        const result = names.same(' GLENAT ');

        expect(result).toBe('Glénat');
    });
    it('gives nothing for a publisher of another key', () => {
        const names = PublisherNames.of([{ name: 'Glénat', books: 2 }]);

        const result = names.same('Kana');

        expect(result).toBeNull();
    });
    it('keeps the spelling used by the most books among spellings of one key', () => {
        const names = PublisherNames.of([
            { name: 'glenat', books: 1 },
            { name: 'Glénat', books: 3 },
            { name: 'GLENAT', books: 2 },
        ]);

        const result = names.same('glenat');

        expect(result).toBe('Glénat');
    });
    it('keeps the first spelling in alphabetical order on a tie', () => {
        const names = PublisherNames.of([
            { name: 'Kana', books: 2 },
            { name: 'KANA', books: 2 },
        ]);

        const result = names.same('kana');

        expect(result).toBe('Kana');
    });
    it('adds up the books of spellings that differ only by outer spaces', () => {
        const names = PublisherNames.of([
            { name: 'Kana ', books: 2 },
            { name: 'Kana', books: 1 },
            { name: 'KANA', books: 2 },
        ]);

        const result = names.same('kana');

        expect(result).toBe('Kana');
    });
    it('lists the similar publishers of another key in alphabetical order', () => {
        const names = PublisherNames.of([
            { name: 'Glénat', books: 1 },
            { name: 'Glématt', books: 1 },
            { name: 'Kana', books: 1 },
        ]);

        const result = names.similar('Glénatt');

        expect(result).toEqual(['Glématt', 'Glénat']);
    });
    it('does not call a publisher of the same key similar', () => {
        const names = PublisherNames.of([{ name: 'Glénat', books: 1 }]);

        const result = names.similar('glenat');

        expect(result).toEqual([]);
    });
    it('suggests the publishers whose name or a later word starts with the search', () => {
        const names = PublisherNames.of([
            { name: 'Pika Édition', books: 1 },
            { name: 'Éditions Delcourt', books: 1 },
            { name: 'Kana', books: 1 },
            { name: 'Médition', books: 1 },
        ]);

        const result = names.search('edition', 10);

        expect(result).toEqual(['Éditions Delcourt', 'Pika Édition']);
    });
    it('suggests one spelling per key', () => {
        const names = PublisherNames.of([
            { name: 'Glénat', books: 3 },
            { name: 'glenat', books: 1 },
        ]);

        const result = names.search('gle', 10);

        expect(result).toEqual(['Glénat']);
    });
    it('suggests at most the asked number of publishers', () => {
        const names = PublisherNames.of([
            { name: 'Kana', books: 1 },
            { name: 'Kami', books: 1 },
            { name: 'Kazé', books: 1 },
        ]);

        const result = names.search('ka', 2);

        expect(result).toEqual(['Kami', 'Kana']);
    });
    it('suggests nothing for an empty search', () => {
        const names = PublisherNames.of([{ name: 'Kana', books: 1 }]);

        const result = names.search('  ', 10);

        expect(result).toEqual([]);
    });
});
