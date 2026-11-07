import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CollectionShoppingView } from '../../collection-views.js';

export interface GetCollectionShoppingUseCase {
    // The collection's last Owned and missing volumes. Owners and Admin only.
    execute(actor: Actor, collectionId: string): Promise<CollectionShoppingView>;
}
