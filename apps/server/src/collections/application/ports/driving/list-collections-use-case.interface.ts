import type { CollectionListPage, CollectionListQuery } from '../../collection-views.js';

export interface ListCollectionsUseCase {
    // Collections by name; with a search, those with at least one matching book.
    execute(query: CollectionListQuery): Promise<CollectionListPage>;
}
