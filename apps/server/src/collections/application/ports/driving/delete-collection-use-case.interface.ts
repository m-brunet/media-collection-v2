import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeleteCollectionUseCase {
    execute(actor: Actor, collectionId: string): Promise<void>;
}
