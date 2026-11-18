import type { Bookcase } from '../domain/entities/bookcase.entity.js';
import type { Shelf } from '../domain/entities/shelf.entity.js';

export class LocationSnapshot {
    static bookcase(bookcase: Bookcase): { name: string; size: string } {
        return { name: bookcase.snapshot.name, size: bookcase.snapshot.size };
    }

    static shelf(shelf: Shelf, bookcase: Bookcase): Record<string, unknown> {
        return {
            name: shelf.snapshot.name,
            bookcaseId: bookcase.id,
            bookcaseName: bookcase.snapshot.name,
        };
    }
}
