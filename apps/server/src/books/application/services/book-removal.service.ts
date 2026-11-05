import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { CollectionMembership } from '../ports/driven/collection-membership.interface.js';
import type { Book } from '../../domain/entities/book.entity.js';
import { BookLoader } from './book-loader.service.js';

// Removes an edition with everyone's reading status and notes on it, its collection membership
// (an emptied collection disappears) and the authors linked to no other book. The caller removes
// the cover file once the operation is committed.
export class BookRemoval {
    constructor(
        private readonly books: BookRepository,
        private readonly authors: AuthorRepository,
        private readonly collections: CollectionMembership,
        private readonly loader: BookLoader,
    ) {}

    async remove(bookId: string): Promise<Book> {
        const book = await this.loader.load(bookId);

        await this.collections.leave(bookId);
        await this.books.delete(bookId);
        await this.authors.removeUnlinked(book.details.authorIds);

        return book;
    }
}
