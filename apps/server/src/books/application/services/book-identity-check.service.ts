import type { DuplicateCandidate } from '../book-views.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { BookDetails } from '../../domain/entities/book.entity.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export class BookIdentityCheck {
    constructor(
        private readonly books: BookRepository,
        private readonly authors: AuthorRepository,
    ) {}

    async ensureUnique(
        details: BookDetails,
        bookId: string,
        confirmDistinct: boolean,
    ): Promise<void> {
        if (details.isbn) {
            const existing = await this.books.findByIsbn(details.isbn.isbn13);

            if (existing && existing.id !== bookId) {
                throw new Failure(
                    'conflict',
                    'A book with this ISBN is already saved.',
                    'isbn-taken',
                    {
                        bookId: existing.id,
                    },
                );
            }
        } else if (!confirmDistinct) {
            const candidates = await this.duplicates(details, [bookId]);

            if (candidates.length > 0) {
                throw new Failure(
                    'conflict',
                    'This book may already be saved.',
                    'possible-duplicate',
                    { candidates },
                );
            }
        }
    }

    async hasPossibleDuplicate(
        details: BookDetails,
        ignoredBookIds: readonly string[],
    ): Promise<boolean> {
        return details.isbn === null && (await this.duplicates(details, ignoredBookIds)).length > 0;
    }

    private async duplicates(
        details: BookDetails,
        ignoredBookIds: readonly string[],
    ): Promise<DuplicateCandidate[]> {
        const title = NameKey.of(details.title);
        const matches = (await this.books.listWithoutIsbn()).filter((book) => {
            const other = book.details;

            return (
                !ignoredBookIds.includes(book.id) &&
                (NameKey.of(other.title) === title ||
                    NameKey.similar(other.title, details.title)) &&
                other.authorIds.some((id) => details.authorIds.includes(id))
            );
        });

        return Promise.all(
            matches.map(async (book) => ({
                id: book.id,
                title: book.details.title,
                authors: (await this.authors.findByIds(book.details.authorIds)).map(
                    (author) => author.snapshot.name,
                ),
            })),
        );
    }
}
