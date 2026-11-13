import { describe, expect, it } from 'vitest';
import { BookFilter } from './book-filter.util';

describe('BookFilter.read', () => {
    it('reads repeated parameters as the chosen values', () => {
        const parameters = new URLSearchParams(
            'category=manga&category=comics&ownership=owned&tag=fantasy&notTag=medieval',
        );

        const result = BookFilter.read(parameters);

        expect(result).toEqual({
            ...BookFilter.empty(),
            category: ['manga', 'comics'],
            ownership: ['owned'],
            tag: ['fantasy'],
            notTag: ['medieval'],
        });
    });
    it('ignores unknown categories, ownerships and reading statuses', () => {
        const parameters = new URLSearchParams('category=vinyl&ownership=lent&reading=maybe');

        const result = BookFilter.read(parameters);

        expect(result).toEqual(BookFilter.empty());
    });
    it('reads the cover and price choices', () => {
        const parameters = new URLSearchParams('cover=without&price=with&price=without');

        const result = BookFilter.read(parameters);

        expect(result).toEqual({
            ...BookFilter.empty(),
            cover: ['without'],
            price: ['with', 'without'],
        });
    });
    it('ignores unknown cover and price choices', () => {
        const parameters = new URLSearchParams('cover=missing&price=free');

        const result = BookFilter.read(parameters);

        expect(result).toEqual(BookFilter.empty());
    });
    it('keeps each value once', () => {
        const parameters = new URLSearchParams('location=none&location=none');

        const result = BookFilter.read(parameters);

        expect(result.location).toEqual(['none']);
    });
});

describe('BookFilter.write', () => {
    it('replaces the filter parameters and keeps the search and sorting', () => {
        const base = new URLSearchParams('search=tolk&sort=added-desc&tag=old');
        const filter = { ...BookFilter.empty(), collection: ['none'], tag: ['fantasy'] };

        const result = BookFilter.write(filter, base);

        expect(result.toString()).toBe('search=tolk&sort=added-desc&collection=none&tag=fantasy');
    });
    it('round-trips through the address', () => {
        const filter = {
            ...BookFilter.empty(),
            author: ['a1', 'a2'],
            location: ['bookcase:b1', 'shelf:s2'],
            reading: ['unread' as const],
        };

        const result = BookFilter.read(BookFilter.write(filter));

        expect(result).toEqual(filter);
    });
    it('writes the cover and price choices to the address', () => {
        const filter = {
            ...BookFilter.empty(),
            cover: ['without' as const],
            price: ['without' as const],
        };

        const result = BookFilter.write(filter);

        expect(result.toString()).toBe('cover=without&price=without');
    });
});

describe('BookFilter tags', () => {
    it('moves a tag from included to excluded', () => {
        const filter = { ...BookFilter.empty(), tag: ['medieval', 'fantasy'] };

        const result = BookFilter.withTag(filter, 'medieval', 'exclude');

        expect(result).toMatchObject({ tag: ['fantasy'], notTag: ['medieval'] });
    });
    it('reads the choice made for a tag', () => {
        const filter = { ...BookFilter.empty(), tag: ['fantasy'], notTag: ['medieval'] };

        const result = ['fantasy', 'medieval', 'history'].map((id) =>
            BookFilter.tagChoice(filter, id),
        );

        expect(result).toEqual(['include', 'exclude', 'none']);
    });
    it('resets every tag choice and keeps the other filters', () => {
        const filter = {
            ...BookFilter.empty(),
            ownership: ['owned' as const],
            tag: ['a'],
            notTag: ['b'],
        };

        const result = BookFilter.withoutTags(filter);

        expect(result).toEqual({ ...BookFilter.empty(), ownership: ['owned'] });
    });
});

describe('BookFilter choices', () => {
    it('toggles a value of a field on and off', () => {
        const filter = BookFilter.toggle(BookFilter.empty(), 'category', 'manga');

        const result = BookFilter.toggle(filter, 'category', 'manga');

        expect([filter.category, result.category]).toEqual([['manga'], []]);
    });
    it('lists the chosen values in field order', () => {
        const filter = {
            ...BookFilter.empty(),
            notTag: ['medieval'],
            ownership: ['owned' as const],
        };

        const result = BookFilter.entries(filter);

        expect(result).toEqual([
            { key: 'ownership', value: 'owned' },
            { key: 'notTag', value: 'medieval' },
        ]);
    });
    it('drops the reading status for a Guest and the collection for collection listings', () => {
        const filter = { ...BookFilter.empty(), reading: ['read' as const], collection: ['c1'] };

        const result = BookFilter.applicable(filter, { guest: true, collections: true });

        expect(result).toEqual(BookFilter.empty());
    });
});
