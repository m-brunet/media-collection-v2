import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CollectionDetailsView } from '../../collection-views.js';

export interface ResumeCollectionUseCase {
    execute(actor: Actor, collectionId: string): Promise<CollectionDetailsView>;
}
