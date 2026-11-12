import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CollectionReadingView } from '../../book-views.js';

export interface GetCollectionReadingUseCase {
    execute(actor: Actor, collectionId: string): Promise<CollectionReadingView>;
}
