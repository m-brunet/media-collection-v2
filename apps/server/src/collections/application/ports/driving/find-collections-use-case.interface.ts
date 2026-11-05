import type { CollectionNameView } from '../../collection-views.js';

export interface FindCollectionsUseCase {
    // Collections whose name contains the search, to choose one for a book.
    execute(search: string): Promise<CollectionNameView[]>;
}
