import { MemberCoverage } from '../member-coverage.helper.js';
import type { CollectionMemberStore } from '../ports/driven/collection-member-store.interface.js';
import type { CollectionRepository } from '../ports/driven/collection-repository.interface.js';

export type UpkeepOutcome = 'removed' | 'reopened' | 'unchanged';

// Keeps a collection consistent after its books changed: a collection without books does not
// exist, and a Finished collection left with missing volumes reopens.
export class CollectionUpkeep {
    constructor(
        private readonly collections: CollectionRepository,
        private readonly members: CollectionMemberStore,
    ) {}

    async tidy(collectionId: string, now: string): Promise<UpkeepOutcome> {
        const collection = await this.collections.findById(collectionId);

        if (!collection) {
            return 'unchanged';
        }

        const records = await this.members.ofCollections([collectionId]);

        if (records.length === 0) {
            await this.collections.delete(collectionId);

            return 'removed';
        }

        if (!collection.reconcile(MemberCoverage.of(records), now)) {
            return 'unchanged';
        }

        await this.collections.save(collection);

        return 'reopened';
    }
}
