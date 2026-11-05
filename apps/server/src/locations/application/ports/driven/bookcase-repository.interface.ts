import type { Bookcase } from '../../../domain/entities/bookcase.entity.js';

export interface BookcaseRepository {
    findById(id: string): Promise<Bookcase | null>;
    findByKey(key: string): Promise<Bookcase | null>;
    list(): Promise<Bookcase[]>;
    // An equivalent name already saved is a conflict (`bookcase-name-taken`).
    create(bookcase: Bookcase): Promise<void>;
    save(bookcase: Bookcase): Promise<void>;
    // Also removes its shelves and their book assignments.
    delete(id: string): Promise<void>;
}
