import type { Tag } from '../../../domain/entities/tag.entity.js';

export interface TagRepository {
    findById(id: string): Promise<Tag | null>;
    findByKey(key: string): Promise<Tag | null>;
    list(): Promise<Tag[]>;
    create(tag: Tag): Promise<void>;
    save(tag: Tag): Promise<void>;
    delete(id: string): Promise<void>;
}
