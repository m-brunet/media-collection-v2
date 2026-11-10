import type { Shelf } from '../../../domain/entities/shelf.entity.js';

export interface ShelfRepository {
    findById(id: string): Promise<Shelf | null>;
    findByKey(bookcaseId: string, key: string): Promise<Shelf | null>;
    list(): Promise<Shelf[]>;
    ofBookcase(bookcaseId: string): Promise<Shelf[]>;
    // An equivalent name in the same bookcase is a conflict (`shelf-name-taken`).
    create(shelf: Shelf): Promise<void>;
    save(shelf: Shelf): Promise<void>;
    // Also removes its book assignments.
    delete(id: string): Promise<void>;
}
