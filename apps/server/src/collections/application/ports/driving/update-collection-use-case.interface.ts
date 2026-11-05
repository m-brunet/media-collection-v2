import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CollectionChanges, CollectionDetailsView } from '../../collection-views.js';

export interface UpdateCollectionUseCase {
    // Renames the collection for every member book and sets whether it includes volume 0.
    execute(
        actor: Actor,
        collectionId: string,
        changes: CollectionChanges,
    ): Promise<CollectionDetailsView>;
}
