import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeleteCollectionUseCase {
    // Deletes the collection only: its books are kept, without membership or coverage.
    execute(actor: Actor, collectionId: string): Promise<void>;
}
