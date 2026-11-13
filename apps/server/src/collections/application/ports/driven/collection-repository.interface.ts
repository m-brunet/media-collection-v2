import type { Collection, CollectionCategory } from '../../../domain/entities/collection.entity.js';

export type CollectionPageQuery = {
    ids: readonly string[] | null;
    categories: readonly CollectionCategory[];
    direction: 'asc' | 'desc';
    offset: number;
    limit: number;
};

export interface CollectionRepository {
    findById(id: string): Promise<Collection | null>;
    findByKey(key: string): Promise<Collection | null>;
    list(): Promise<Collection[]>;
    page(query: CollectionPageQuery): Promise<{ total: number; collections: Collection[] }>;
    create(collection: Collection): Promise<void>;
    save(collection: Collection): Promise<void>;
    delete(id: string): Promise<void>;
}
