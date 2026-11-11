import type { Author } from '../../../domain/entities/author.entity.js';

export interface AuthorRepository {
    findById(id: string): Promise<Author | null>;
    findByIds(ids: readonly string[]): Promise<Author[]>;
    findByKey(key: string): Promise<Author | null>;
    list(): Promise<Author[]>;
    create(author: Author): Promise<void>;
    save(author: Author): Promise<void>;
    removeUnlinked(ids: readonly string[]): Promise<void>;
}
