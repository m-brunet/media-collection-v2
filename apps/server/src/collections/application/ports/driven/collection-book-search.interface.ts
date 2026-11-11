import type { BookFilter } from '../../../../shared/application/book-filter.js';

export interface CollectionBookSearch {
    collectionsMatching(
        search: string,
        filter: BookFilter,
        readerId: string | null,
    ): Promise<string[]>;
}
