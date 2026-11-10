import type { BookLocation } from './book-location-reader.interface.js';

// Every call joins the transaction of the book operation in progress.
export interface ShelfAssignment {
    // Places the book on an existing shelf, or leaves it unassigned when null. An unknown shelf is
    // refused (`shelf-missing`): locations are created beforehand, never from a book.
    assign(bookId: string, shelfId: string | null): Promise<BookLocation | null>;
}
