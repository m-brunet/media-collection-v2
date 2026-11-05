import type { Collection } from '../../../domain/entities/collection.entity.js';

export type CollectionPageQuery = {
    // Only these collections, or every collection when null.
    ids: readonly string[] | null;
    direction: 'asc' | 'desc';
    offset: number;
    limit: number;
};

export interface CollectionRepository {
    findById(id: string): Promise<Collection | null>;
    findByKey(key: string): Promise<Collection | null>;
    list(): Promise<Collection[]>;
    // Ordered by name, then identity.
    page(query: CollectionPageQuery): Promise<{ total: number; collections: Collection[] }>;
    // An equivalent name already saved is a conflict (`collection-name-taken`).
    create(collection: Collection): Promise<void>;
    save(collection: Collection): Promise<void>;
    delete(id: string): Promise<void>;
}
