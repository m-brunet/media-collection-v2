import type { Bookcase } from '../domain/entities/bookcase.entity.js';
import type { Shelf } from '../domain/entities/shelf.entity.js';

// Audit categories of the locations feature, all shared changes eligible for Activity.
export const LocationAudit = {
    bookcase: 'bookcase',
    shelf: 'shelf',
    bookcaseCreated: 'bookcase.created',
    bookcaseRenamed: 'bookcase.renamed',
    bookcaseDeleted: 'bookcase.deleted',
    shelfCreated: 'shelf.created',
    shelfRenamed: 'shelf.renamed',
    shelfMoved: 'shelf.moved',
    shelfDeleted: 'shelf.deleted',
} as const;

export class LocationSnapshot {
    static bookcase(bookcase: Bookcase): Record<string, unknown> {
        return { name: bookcase.snapshot.name };
    }

    static shelf(shelf: Shelf, bookcase: Bookcase): Record<string, unknown> {
        return {
            name: shelf.snapshot.name,
            bookcaseId: bookcase.id,
            bookcaseName: bookcase.snapshot.name,
        };
    }
}
