import type { BookShelfStore } from '../ports/driven/book-shelf-store.interface.js';
import { LocationLoader } from './location-loader.service.js';
import type {
    BookLocation,
    BookLocationReader,
} from '../../../books/application/ports/driven/book-location-reader.interface.js';
import type { ShelfAssignment } from '../../../books/application/ports/driven/shelf-assignment.interface.js';

// Places books on existing shelves for the books feature. Locations are never created from a
// book: an unknown shelf is refused.
export class BookShelfAssignment implements ShelfAssignment, BookLocationReader {
    constructor(
        private readonly store: BookShelfStore,
        private readonly loader: LocationLoader,
    ) {}

    async assign(bookId: string, shelfId: string | null): Promise<BookLocation | null> {
        if (shelfId === null) {
            await this.store.remove(bookId);

            return null;
        }

        const location = await this.location(shelfId);

        await this.store.place(bookId, shelfId);

        return location;
    }

    async of(bookId: string): Promise<BookLocation | null> {
        const shelfId = await this.store.shelfOf(bookId);

        return shelfId === null ? null : this.location(shelfId);
    }

    private async location(shelfId: string): Promise<BookLocation> {
        const shelf = await this.loader.shelf(shelfId);
        const bookcase = await this.loader.bookcase(shelf.snapshot.bookcaseId);

        return {
            bookcaseId: bookcase.id,
            bookcaseName: bookcase.snapshot.name,
            shelfId: shelf.id,
            shelfName: shelf.snapshot.name,
        };
    }
}
