import type { BookLocation } from './book-location-reader.interface.js';

export interface ShelfLocator {
    locate(shelfId: string): Promise<BookLocation>;
}
