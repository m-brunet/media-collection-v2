import type { GetCollectionReadingUseCase } from '../ports/driving/get-collection-reading-use-case.interface.js';
import type { CollectionReadingView } from '../book-views.js';
import type { CollectionOwnedBooks } from '../ports/driven/collection-owned-books.interface.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import { CollectionReading } from '../../domain/value-objects/collection-reading.value-object.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class GetCollectionReading implements GetCollectionReadingUseCase {
    constructor(
        private readonly collections: CollectionOwnedBooks,
        private readonly readings: ReadingStatusStore,
    ) {}

    async execute(actor: Actor, collectionId: string): Promise<CollectionReadingView> {
        ActorAuthorization.requireLibraryEditor(actor);
        const owned = await this.collections.of(collectionId);

        return CollectionReading.of(owned, await this.readings.readAmong(actor.id, owned)).view;
    }
}
