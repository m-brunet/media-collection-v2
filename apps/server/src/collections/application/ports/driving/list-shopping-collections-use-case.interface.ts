import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { ShoppingCollectionView } from '../../collection-views.js';

export interface ListShoppingCollectionsUseCase {
    execute(actor: Actor): Promise<ShoppingCollectionView[]>;
}
