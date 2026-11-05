import type { Collection } from '../domain/entities/collection.entity.js';
import type { RelatedChange } from '../../shared/application/ports/driven/audit-entry.interface.js';

// Audit categories of the collections feature, all shared changes eligible for Activity
// (Task 8). Creating, automatically reopening and removing a collection happen inside a book
// operation: they are recorded as its related changes, under the same operation ID.
export const CollectionAudit = {
    collection: 'collection',
    created: 'collection.created',
    updated: 'collection.updated',
    finished: 'collection.finished',
    reopened: 'collection.reopened',
    deleted: 'collection.deleted',
    removed: 'collection.removed',
} as const;

export class CollectionSnapshot {
    static of(collection: Collection): Record<string, unknown> {
        const { name, includesVolumeZero, finished } = collection.snapshot;

        return { name, includesVolumeZero, finished };
    }
}

// A collection change made as a consequence of a book operation.
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
