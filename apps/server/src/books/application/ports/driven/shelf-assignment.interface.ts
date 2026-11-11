import type { BookLocation } from './book-location-reader.interface.js';

export interface ShelfAssignment {
    assign(bookId: string, shelfId: string | null): Promise<BookLocation | null>;
}
