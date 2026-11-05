import type { CollectionDetailsView } from '../../collection-views.js';

export interface GetCollectionUseCase {
    execute(collectionId: string): Promise<CollectionDetailsView>;
}
