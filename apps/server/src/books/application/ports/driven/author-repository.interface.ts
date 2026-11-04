import type { Author } from '../../../domain/entities/author.entity.js';

export interface AuthorRepository {
    findById(id: string): Promise<Author | null>;
    findByIds(ids: readonly string[]): Promise<Author[]>;
    // The author whose name is equivalent (same comparison key), if any.
    findByKey(key: string): Promise<Author | null>;
    list(): Promise<Author[]>;
    // An equivalent name already saved is a conflict (`author-name-taken`).
    create(author: Author): Promise<void>;
    save(author: Author): Promise<void>;
    // Removes those of the given authors that no book links to any more.
    removeUnlinked(ids: readonly string[]): Promise<void>;
}
