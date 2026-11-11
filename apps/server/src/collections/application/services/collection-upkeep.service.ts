import { CollectionAudit, CollectionChange } from '../collection-audit.js';
import { MemberCoverage } from '../member-coverage.helper.js';
import type { CollectionMemberStore } from '../ports/driven/collection-member-store.interface.js';
import type { CollectionRepository } from '../ports/driven/collection-repository.interface.js';
import { Collection } from '../../domain/entities/collection.entity.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';

export class CollectionUpkeep {
    constructor(
        private readonly collections: CollectionRepository,
        private readonly members: CollectionMemberStore,
    ) {}

    async tidy(collectionId: string, now: string): Promise<RelatedChange | null> {
        const collection = await this.collections.findById(collectionId);

        if (!collection) {
            return null;
        }

        const records = await this.members.ofCollections([collectionId]);

        if (records.length === 0) {
            await this.collections.delete(collectionId);

            return CollectionChange.of(CollectionAudit.removed, collectionId, collection, null);
        }

        const before = new Collection(collection.snapshot);

        if (!collection.reconcile(MemberCoverage.of(records), now)) {
            return null;
        }

        await this.collections.save(collection);

        return CollectionChange.of(CollectionAudit.reopened, collectionId, before, collection);
    }
}
