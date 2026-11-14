import type { CollectionMemberStore } from '../ports/driven/collection-member-store.interface.js';
import type { CollectionLoader } from './collection-loader.service.js';
import { MemberCoverage } from '../member-coverage.helper.js';
import type {
    CollectionVolumes,
    CollectionVolumesView,
} from '../../../books/application/ports/driven/collection-volumes.interface.js';

export class CollectionVolumeReader implements CollectionVolumes {
    constructor(
        private readonly loader: CollectionLoader,
        private readonly members: CollectionMemberStore,
    ) {}

    async of(collectionId: string, upTo: number): Promise<CollectionVolumesView> {
        const collection = await this.loader.load(collectionId);
        const records = await this.members.ofCollections([collectionId]);
        const { id, name, category } = collection.snapshot;

        return {
            id,
            name,
            category,
            members: records.map(({ bookId, volumeFrom, volumeTo, isbn }) => ({
                bookId,
                volumeFrom,
                volumeTo,
                isbn,
            })),
            uncovered: collection.coverage(MemberCoverage.of(records)).uncovered(upTo),
        };
    }
}
