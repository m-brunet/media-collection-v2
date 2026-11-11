import type { CollectionNameView } from '../../collection-views.js';

export interface FindCollectionsUseCase {
    execute(search: string): Promise<CollectionNameView[]>;
}
