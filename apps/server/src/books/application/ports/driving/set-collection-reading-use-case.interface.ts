import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CollectionReadingView } from '../../book-views.js';

export interface SetCollectionReadingUseCase {
    execute(actor: Actor, collectionId: string, read: boolean): Promise<CollectionReadingView>;
}
