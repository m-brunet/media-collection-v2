import type { ListShoppingCollectionsUseCase } from '../ports/driving/list-shopping-collections-use-case.interface.js';
import type { ShoppingCollectionView } from '../collection-views.js';
import type { CollectionMemberStore } from '../ports/driven/collection-member-store.interface.js';
import type { CollectionRepository } from '../ports/driven/collection-repository.interface.js';
import { CollectionViewer } from '../services/collection-viewer.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class ListShoppingCollections implements ListShoppingCollectionsUseCase {
    constructor(
        private readonly collections: CollectionRepository,
        private readonly members: CollectionMemberStore,
        private readonly viewer: CollectionViewer,
    ) {}

    async execute(actor: Actor): Promise<ShoppingCollectionView[]> {
        ActorAuthorization.requireLibraryEditor(actor);
        const unfinished = (await this.collections.list()).filter(
            (collection) => !collection.snapshot.finished,
        );
        const records = await this.members.ofCollections(
            unfinished.map((collection) => collection.id),
        );

        return unfinished.map((collection) =>
            this.viewer.shoppingSummary(
                collection,
                records.filter((record) => record.collectionId === collection.id),
            ),
        );
    }
}
