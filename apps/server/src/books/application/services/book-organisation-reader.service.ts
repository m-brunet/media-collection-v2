import type { BookOrganisation } from '../book-views.js';
import type { BookLocationReader } from '../ports/driven/book-location-reader.interface.js';
import type { BookTagReader } from '../ports/driven/book-tag-reader.interface.js';

// The current location and tags of a book, read from the locations and tags features.
export class BookOrganisationReader {
    constructor(
        private readonly locations: BookLocationReader,
        private readonly tags: BookTagReader,
    ) {}

    async current(bookId: string): Promise<BookOrganisation> {
        return { location: await this.locations.of(bookId), tags: await this.tags.of(bookId) };
    }
}
