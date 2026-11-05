import type { Tag } from '../../../domain/entities/tag.entity.js';

export interface TagRepository {
    findById(id: string): Promise<Tag | null>;
    findByKey(key: string): Promise<Tag | null>;
    // Ordered by name.
    list(): Promise<Tag[]>;
    // An equivalent name already saved is a conflict (`tag-name-taken`).
    create(tag: Tag): Promise<void>;
    save(tag: Tag): Promise<void>;
    // Also removes it from every book.
    delete(id: string): Promise<void>;
}
