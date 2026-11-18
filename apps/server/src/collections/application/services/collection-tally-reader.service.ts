import type { CollectionMemberStore } from '../ports/driven/collection-member-store.interface.js';
import type { CollectionRepository } from '../ports/driven/collection-repository.interface.js';
import type { CollectionViewer } from './collection-viewer.service.js';
import type {
    CollectionTallies,
    CollectionTally,
} from '../../../statistics/application/ports/driven/collection-tallies.interface.js';

export class CollectionTallyReader implements CollectionTallies {
    constructor(
        private readonly collections: CollectionRepository,
        private readonly members: CollectionMemberStore,
        private readonly viewer: CollectionViewer,
    ) {}

    async all(): Promise<CollectionTally[]> {
        const collections = await this.collections.list();
        const records = await this.members.ofCollections(
            collections.map((collection) => collection.id),
        );

        return collections.map((collection) => {
            const own = records.filter((record) => record.collectionId === collection.id);
            const summary = this.viewer.summary(collection, own);

            return {
                id: summary.id,
                name: summary.name,
                category: summary.category,
                status: summary.status,
                ownedBooks: own.filter((record) => record.ownership === 'owned').length,
                missingVolumes: summary.missingCount,
            };
        });
    }
}
