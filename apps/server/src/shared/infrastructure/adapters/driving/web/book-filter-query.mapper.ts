import type { BookFilterParams } from './book-filter-query.js';
import { BookFilter } from '../../../../application/book-filter.js';

// Turns the filter query parameters into a book filter. Stored ids are lowercase, so ids are
// compared in lowercase whatever their case in the address.
export class BookFilterQueryMapper {
    static toFilter(params: BookFilterParams): BookFilter {
        const id = (value: string) => value.toLowerCase();
        const located = (kind: string) =>
            params.location
                .filter((value) => value.startsWith(kind + ':'))
                .map((value) => id(value.slice(kind.length + 1)));

        return BookFilter.of({
            categories: params.category,
            authorIds: params.author.map(id),
            collections: {
                ids: params.collection.filter((value) => value !== 'none').map(id),
                none: params.collection.includes('none'),
            },
            locations: {
                bookcaseIds: located('bookcase'),
                shelfIds: located('shelf'),
                none: params.location.includes('none'),
            },
            ownerships: params.ownership,
            reading: params.reading,
            tags: { include: params.tag.map(id), exclude: params.notTag.map(id) },
        });
    }
}
