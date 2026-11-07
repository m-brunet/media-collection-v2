import type { GetCollectionShoppingUseCase } from '../ports/driving/get-collection-shopping-use-case.interface.js';
import type { CollectionShoppingView } from '../collection-views.js';
import type { CollectionMemberStore } from '../ports/driven/collection-member-store.interface.js';
import { CollectionLoader } from '../services/collection-loader.service.js';
import { CollectionViewer } from '../services/collection-viewer.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class GetCollectionShopping implements GetCollectionShoppingUseCase {
    constructor(
        private readonly loader: CollectionLoader,
        private readonly members: CollectionMemberStore,
        private readonly viewer: CollectionViewer,
    ) {}

    async execute(actor: Actor, collectionId: string): Promise<CollectionShoppingView> {
        ActorAuthorization.requireLibraryEditor(actor);
        const collection = await this.loader.load(collectionId);

        return this.viewer.shopping(collection, await this.members.ofCollections([collectionId]));
    }
}
