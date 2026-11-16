import { CollectionAudit } from './collection-audit.js';
import { CollectionSnapshot } from './collection-snapshot.helper.js';
import type { Collection } from '../domain/entities/collection.entity.js';
import type { RelatedChange } from '../../shared/application/ports/driven/audit-entry.interface.js';

export class CollectionChange {
    static of(
        category: string,
        collectionId: string,
        before: Collection | null,
        after: Collection | null,
    ): RelatedChange {
        return {
            category,
            subjectType: CollectionAudit.collection,
            subjectId: collectionId,
            before: before ? CollectionSnapshot.of(before) : null,
            after: after ? CollectionSnapshot.of(after) : null,
        };
    }
}
