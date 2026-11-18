import type { Collection } from '../domain/entities/collection.entity.js';

export class CollectionSnapshot {
    static of(collection: Collection): Record<string, unknown> {
        const { name, category, includesVolumeZero, status } = collection.snapshot;

        return { name, category, includesVolumeZero, status };
    }
}
