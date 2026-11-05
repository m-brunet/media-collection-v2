import type { Collection } from '../domain/entities/collection.entity.js';

// Audit categories of the collections feature, all shared changes eligible for Activity
// (Task 8). Creating, automatically reopening and removing a collection happen inside a book
// operation, whose snapshots record the book's membership; they have no record of their own.
export const CollectionAudit = {
    collection: 'collection',
    updated: 'collection.updated',
    finished: 'collection.finished',
    reopened: 'collection.reopened',
    deleted: 'collection.deleted',
} as const;

export class CollectionSnapshot {
    static of(collection: Collection): Record<string, unknown> {
        const { name, includesVolumeZero, finished } = collection.snapshot;

        return { name, includesVolumeZero, finished };
    }
}
