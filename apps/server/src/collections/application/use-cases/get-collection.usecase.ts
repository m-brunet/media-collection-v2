import type { GetCollectionUseCase } from '../ports/driving/get-collection-use-case.interface.js';
import type { CollectionDetailsView } from '../collection-views.js';
import type { CollectionMemberStore } from '../ports/driven/collection-member-store.interface.js';
import { CollectionLoader } from '../services/collection-loader.service.js';
import { CollectionViewer } from '../services/collection-viewer.service.js';

export class GetCollection implements GetCollectionUseCase {
    constructor(
        private readonly loader: CollectionLoader,
        private readonly members: CollectionMemberStore,
        private readonly viewer: CollectionViewer,
    ) {}

    async execute(collectionId: string): Promise<CollectionDetailsView> {
        const collection = await this.loader.load(collectionId);

        return this.viewer.details(collection, await this.members.ofCollections([collectionId]));
    }
}
