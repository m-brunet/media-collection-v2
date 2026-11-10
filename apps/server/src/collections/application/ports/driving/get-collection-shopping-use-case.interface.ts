import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CollectionShoppingView } from '../../collection-views.js';

export interface GetCollectionShoppingUseCase {
    execute(actor: Actor, collectionId: string): Promise<CollectionShoppingView>;
}
