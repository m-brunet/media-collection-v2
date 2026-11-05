import type { BookFilter } from '../../../../shared/application/book-filter.js';

// The library's book search and advanced filters, applied to collection listings: a collection
// matches when at least one of its books satisfies the whole search and filter together.
export interface CollectionBookSearch {
    // `readerId` is the account whose reading status the filter may use; null for Guests.
    collectionsMatching(
        search: string,
        filter: BookFilter,
        readerId: string | null,
    ): Promise<string[]>;
}
