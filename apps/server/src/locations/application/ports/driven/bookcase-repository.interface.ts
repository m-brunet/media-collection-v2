import type { Bookcase } from '../../../domain/entities/bookcase.entity.js';

export interface BookcaseRepository {
    findById(id: string): Promise<Bookcase | null>;
    findByKey(key: string): Promise<Bookcase | null>;
    list(): Promise<Bookcase[]>;
    create(bookcase: Bookcase): Promise<void>;
    save(bookcase: Bookcase): Promise<void>;
    delete(id: string): Promise<void>;
}
