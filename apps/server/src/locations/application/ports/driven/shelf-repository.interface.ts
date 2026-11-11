import type { Shelf } from '../../../domain/entities/shelf.entity.js';

export interface ShelfRepository {
    findById(id: string): Promise<Shelf | null>;
    findByKey(bookcaseId: string, key: string): Promise<Shelf | null>;
    list(): Promise<Shelf[]>;
    ofBookcase(bookcaseId: string): Promise<Shelf[]>;
    create(shelf: Shelf): Promise<void>;
    save(shelf: Shelf): Promise<void>;
    delete(id: string): Promise<void>;
}
