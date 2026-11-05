import { describe, expect, it } from 'vitest';
import type { BookFilterParams } from './book-filter-query.js';
import { BookFilterQueryMapper } from './book-filter-query.mapper.js';

const id = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE';
const lower = id.toLowerCase();

function params(overrides: Partial<BookFilterParams> = {}): BookFilterParams {
    return {
        category: [],
        author: [],
        collection: [],
        location: [],
        ownership: [],
        reading: [],
        tag: [],
        notTag: [],
        ...overrides,
    };
}

describe('BookFilterQueryMapper', () => {
    it('keeps every book without parameters', () => {
        const query = params();

        const result = BookFilterQueryMapper.toFilter(query);

        expect(result.isEmpty()).toBe(true);
    });
    it('separates collection ids from No collection', () => {
        const query = params({ collection: [lower, 'none'] });

        const result = BookFilterQueryMapper.toFilter(query);

        expect(result.collections).toEqual({ ids: [lower], none: true });
    });
    it('separates bookcases, shelves and No location', () => {
        const query = params({ location: ['bookcase:' + lower, 'shelf:' + lower, 'none'] });

        const result = BookFilterQueryMapper.toFilter(query);

        expect(result.locations).toEqual({ bookcaseIds: [lower], shelfIds: [lower], none: true });
    });
    it('compares every id in lowercase', () => {
        const query = params({
            author: [id],
            collection: [id],
            location: ['shelf:' + id],
            tag: [id],
            notTag: [id],
        });

        const result = BookFilterQueryMapper.toFilter(query);

        expect([
            result.authorIds,
            result.collections.ids,
            result.locations.shelfIds,
            result.tags.include,
            result.tags.exclude,
        ]).toEqual([[lower], [lower], [lower], [lower], [lower]]);
    });
    it('keeps categories, ownerships and reading choices', () => {
        const query = params({
            category: ['manga', 'comics'],
            ownership: ['owned'],
            reading: ['read'],
        });

        const result = BookFilterQueryMapper.toFilter(query);

        expect(result).toMatchObject({
            categories: ['manga', 'comics'],
            ownerships: ['owned'],
            reading: ['read'],
        });
    });
});
