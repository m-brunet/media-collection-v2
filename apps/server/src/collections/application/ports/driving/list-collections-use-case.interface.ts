import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CollectionListPage, CollectionListQuery } from '../../collection-views.js';

export interface ListCollectionsUseCase {
    execute(actor: Actor, query: CollectionListQuery): Promise<CollectionListPage>;
}
