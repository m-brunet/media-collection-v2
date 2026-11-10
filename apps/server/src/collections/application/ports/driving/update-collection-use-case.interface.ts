import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CollectionChanges, CollectionDetailsView } from '../../collection-views.js';

export interface UpdateCollectionUseCase {
    execute(
        actor: Actor,
        collectionId: string,
        changes: CollectionChanges,
    ): Promise<CollectionDetailsView>;
}
