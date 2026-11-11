import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { CollectionMembership } from '../ports/driven/collection-membership.interface.js';
import type { LoanHistory } from '../ports/driven/loan-history.interface.js';
import type { Book } from '../../domain/entities/book.entity.js';
import { BookLoader } from './book-loader.service.js';
import { LentBookGuard } from './lent-book-guard.service.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';

export type BookRemoved = { book: Book; changes: RelatedChange[] };

export class BookRemoval {
    constructor(
        private readonly books: BookRepository,
        private readonly authors: AuthorRepository,
        private readonly collections: CollectionMembership,
        private readonly loader: BookLoader,
        private readonly guard: LentBookGuard,
        private readonly history: LoanHistory,
    ) {}

    async remove(bookId: string): Promise<BookRemoved> {
        const book = await this.loader.load(bookId);

        await this.guard.ensureNotLent(bookId);
        const changes = await this.collections.leave(bookId);
        const { title, isbn } = book.details;

        await this.history.retain({ id: bookId, title, isbn: isbn?.isbn13 ?? null });

        await this.books.delete(bookId);
        await this.authors.removeUnlinked(book.details.authorIds);

        return { book, changes };
    }
}
