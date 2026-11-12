import type { BookShelfStore } from '../ports/driven/book-shelf-store.interface.js';
import { LocationLoader } from './location-loader.service.js';
import type {
    BookLocation,
    BookLocationReader,
} from '../../../books/application/ports/driven/book-location-reader.interface.js';
import type { ShelfAssignment } from '../../../books/application/ports/driven/shelf-assignment.interface.js';
import type { ShelfLocator } from '../../../books/application/ports/driven/shelf-locator.interface.js';

export class BookShelfAssignment implements ShelfAssignment, BookLocationReader, ShelfLocator {
    constructor(
        private readonly store: BookShelfStore,
        private readonly loader: LocationLoader,
    ) {}

    async assign(bookId: string, shelfId: string | null): Promise<BookLocation | null> {
        if (shelfId === null) {
            await this.store.remove(bookId);

            return null;
        }

        const location = await this.locate(shelfId);

        await this.store.place(bookId, shelfId);

        return location;
    }

    async of(bookId: string): Promise<BookLocation | null> {
        const shelfId = await this.store.shelfOf(bookId);

        return shelfId === null ? null : this.locate(shelfId);
    }

    async locate(shelfId: string): Promise<BookLocation> {
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
